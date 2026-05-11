import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';

async function test() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const dbs = await client.db().admin().listDatabases();
  console.log(dbs.databases.map(d => d.name));
  await client.close();
}

test();
