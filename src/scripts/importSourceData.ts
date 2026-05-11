import { MongoClient } from 'mongodb';
import { EJSON } from 'bson';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const SOURCE_DB_NAME = 'source_db';
const SAMPLE_DATA_DIR = path.join(__dirname, '..', 'data', 'sample');

async function importData() {
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log('Connected to local MongoDB');
    const db = client.db(SOURCE_DB_NAME);

    const collections = ['item', 'time', 'fact_data'];

    for (const col of collections) {
      const filePath = path.join(SAMPLE_DATA_DIR, `${col}.json`);
      if (fs.existsSync(filePath)) {
        console.log(`Importing ${col} from ${filePath}...`);
        const rawData = fs.readFileSync(filePath, 'utf8');
        const data = EJSON.parse(rawData) as any[];
        
        // Remove existing and insert new
        await db.collection(col).deleteMany({});
        if (data.length > 0) {
            // Chunked insertion
            const chunkSize = 1000;
            for (let i = 0; i < data.length; i += chunkSize) {
                const chunk = data.slice(i, i + chunkSize);
                await db.collection(col).insertMany(chunk);
            }
            console.log(`Imported ${data.length} records into ${col}.`);
        }
      } else {
        console.warn(`File ${filePath} not found.`);
      }
    }

    console.log('Import completed successfully!');
  } catch (error) {
    console.error('Import failed:', error);
  } finally {
    await client.close();
  }
}

importData();
