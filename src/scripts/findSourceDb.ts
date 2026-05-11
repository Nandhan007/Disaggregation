import { MongoClient } from 'mongodb';

const ips = [
  '192.168.68.87',
  '159.41.185.49',
  '159.41.185.61',
  '159.41.192.102'
];

async function findSourceDb() {
  for (const ip of ips) {
    const uri = `mongodb://${ip}:27017`;
    console.log(`Trying ${uri}...`);
    const client = new MongoClient(uri);
    try {
      await client.connect();
      const dbs = await client.db().admin().listDatabases();
      const dbNames = dbs.databases.map(d => d.name);
      console.log(`IP ${ip} has databases:`, dbNames);
      if (dbNames.includes('source_db')) {
        console.log(`*** FOUND source_db at ${uri} ***`);
      }
      await client.close();
    } catch (e) {
      console.log(`Failed to connect to ${ip}`);
    }
  }
}

findSourceDb();
