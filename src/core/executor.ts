import { DBClient } from '../db/mongoClient';
import { SalesFact } from '../types';
import { Worker } from 'worker_threads';
import * as path from 'path';

export class Executor {
  private dbClient: DBClient;

  constructor(dbClient: DBClient) {
    this.dbClient = dbClient; // Main thread dbClient, not used by workers but kept for API compatibility
  }

  /**
   * Splits the data into chunks and processes them in parallel using worker threads
   */
  async executeInChunks(data: SalesFact[], dataSource: string, targetMeasure: string, chunkSize: number = 5000): Promise<void> {
    const chunks: SalesFact[][] = [];
    
    for (let i = 0; i < data.length; i += chunkSize) {
      chunks.push(data.slice(i, i + chunkSize));
    }

    console.log(`[Executor] Split ${data.length} records into ${chunks.length} chunks of size ${chunkSize}`);

    const promises = chunks.map((chunk, index) => {
      return new Promise<void>((resolve, reject) => {
        // Run .ts directly with ts-node if in dev mode
        const isTs = path.extname(__filename) === '.ts';
        const workerPath = isTs ? path.join(__dirname, 'worker.ts') : path.join(__dirname, 'worker.js');
        const workerOpts = isTs ? { execArgv: ['-r', 'ts-node/register'] } : {};
        console.log(`[Executor] Starting Worker for chunk ${index}...`);
        const worker = new Worker(workerPath, {
          ...workerOpts,
          stdout: true,
          stderr: true
        });

        // Pipe worker logs to parent terminal
        worker.stdout.on('data', (data) => {
          const lines = data.toString().split('\n');
          lines.forEach((line: string) => {
            if (line.trim()) console.log(`[Worker ${index} LOG] ${line.trim()}`);
          });
        });
        worker.stderr.on('data', (data) => {
          console.error(`[Worker ${index} ERR] ${data.toString().trim()}`);
        });

        worker.on('online', () => {
          console.log(`[Executor] Worker ${index} is now online.`);
        });

        worker.on('message', (msg) => {
          if (msg.success) {
            console.log(`[Executor] Worker ${msg.chunkIndex} SUCCESS: Upserted: ${msg.upsertedCount}, Modified: ${msg.modifiedCount}`);
            resolve();
          } else {
            console.error(`[Executor] Worker ${msg.chunkIndex} FAILED: ${msg.error}`);
            reject(new Error(msg.error));
          }
          // DO NOT call worker.terminate() here. It can cause a segmentation fault 
          // if the MongoDB C++ driver is still cleaning up. The worker will exit naturally.
        });

        worker.on('error', (err) => {
          console.error(`[Executor] Worker ${index} FATAL ERROR:`, err);
          reject(err);
          worker.terminate();
        });

        worker.on('exit', (code) => {
          if (code !== 0) {
            reject(new Error(`Worker stopped with exit code ${code}`));
          }
        });

        // Send the payload to the worker
        worker.postMessage({ chunk, chunkIndex: index, retries: 3, dataSource, targetMeasure });
      });
    });

    await Promise.all(promises);
    console.log(`[Executor] Completed execution of all chunks via worker threads.`);
  }
}
