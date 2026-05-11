import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'disagg_normalized_db';

async function analyze() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db(DB_NAME);

    const bu = await db.collection('item').distinct('BusinessUnit');
    const dept = await db.collection('item').distinct('Department');
    const years = await db.collection('time').distinct('Year');

    console.log('Business Units:', bu);
    console.log('Departments:', dept);
    console.log('Years:', years);

    const sampleItem = await db.collection('item').findOne();
    const sampleTime = await db.collection('time').findOne();

    console.log('Sample Item:', sampleItem);
    console.log('Sample Time:', sampleTime);

  } finally {
    await client.close();
  }
}

analyze();
