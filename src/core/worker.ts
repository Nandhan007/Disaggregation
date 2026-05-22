import { parentPort, workerData } from 'worker_threads';
import { DBClient } from '../db/mongoClient';
import { SalesFact } from '../types';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'disagg_normalized_db';

if (parentPort) {
  parentPort.on('message', async (message: { chunk: SalesFact[], chunkIndex: number, retries?: number, dataSource: string, targetMeasure: string }) => {
    const { chunk, chunkIndex, retries = 3, dataSource, targetMeasure } = message;
    console.log(`[Worker ${chunkIndex}] Starting processing for ${chunk.length} records in ${dataSource}...`);
    
    // Each worker instantiates its own DBClient and connects to MongoDB.
    const dbClient = new DBClient(MONGO_URI, DB_NAME);
    
    try {
      await dbClient.connect();
      console.log(`[Worker ${chunkIndex}] Connected to MongoDB.`);
      
      let success = false;
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          console.log(`[Worker ${chunkIndex}] Executing bulk upsert (Attempt ${attempt})...`);
          const result = await dbClient.bulkUpsertSalesFact(chunk, dataSource, targetMeasure);
          parentPort?.postMessage({
            success: true,
            chunkIndex,
            upsertedCount: result.upsertedCount,
            modifiedCount: result.modifiedCount
          });
          success = true;
          break; // Exit retry loop on success
        } catch (error: any) {
          if (attempt === retries) {
            parentPort?.postMessage({
              success: false,
              chunkIndex,
              error: `Chunk ${chunkIndex} failed after ${retries} attempts: ${error.message}`
            });
          }
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, attempt * 1000));
        }
      }
    } catch (err: any) {
       parentPort?.postMessage({
          success: false,
          chunkIndex,
          error: `Worker connection error for chunk ${chunkIndex}: ${err.message}`
       });
    } finally {
      // Always ensure the client disconnects after completing the chunk
      await dbClient.disconnect();
    }
  });
}
