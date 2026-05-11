import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';

async function test() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db('source_db');
  
  const items = await db.collection('item').countDocuments();
  const times = await db.collection('time').countDocuments();
  const facts = await db.collection('fact_data').countDocuments();
  
  console.log(`Counts -> items: ${items}, times: ${times}, facts: ${facts}`);
  await client.close();
}

test();
