import { DBClient } from './db/mongoClient';
import { Executor } from './core/executor';
import { MathEngine } from './core/mathEngine';
import dotenv from 'dotenv';
dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'disagg_db';

async function run() {
  const dbClient = new DBClient(MONGO_URI, DB_NAME);
  await dbClient.connect();
  const executor = new Executor(dbClient);
  
  const chunk = [
    {
      item_id: 'ITEM_TEST',
      location_id: 'LOC_TEST',
      time_id: '2024-01-01',
      scenario_id: 'WORKER_TEST',
      planned_sales: 999,
      is_override: false,
      updated_at: new Date(),
      version: 1
    }
  ];

  console.log('Testing executor via worker thread...');
  await executor.executeInChunks(chunk, 1);
  console.log('Executor finished successfully.');
  
  await dbClient.disconnect();
}

run().catch(console.error);
