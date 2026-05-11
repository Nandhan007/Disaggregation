import { MongoClient, ObjectId } from 'mongodb';
import * as dotenv from 'dotenv';
import { normalizeFactRecord, SourceFact } from '../core/normalization';

dotenv.config();

const SOURCE_MONGO_URI = process.env.SOURCE_MONGO_URI || 'mongodb://localhost:27017';
const TARGET_MONGO_URI = process.env.TARGET_MONGO_URI || 'mongodb://localhost:27017';
const SOURCE_DB_NAME = process.env.SOURCE_DB_NAME || 'source_db';
const TARGET_DB_NAME = process.env.TARGET_DB_NAME || 'disagg_normalized_db';

async function runMigration() {
  console.log(`Connecting to Source: ${SOURCE_MONGO_URI}`);
  console.log(`Connecting to Target: ${TARGET_MONGO_URI}`);
  
  const sourceClient = new MongoClient(SOURCE_MONGO_URI);
  const targetClient = new MongoClient(TARGET_MONGO_URI);

  try {
    await sourceClient.connect();
    await targetClient.connect();
    console.log('Connected to both Source and Target MongoDB instances');

    const sourceAdmin = sourceClient.db().admin();
    const sourceDbs = await sourceAdmin.listDatabases();
    
    if (!sourceDbs.databases.find(d => d.name === SOURCE_DB_NAME)) {
        console.error(`Source database ${SOURCE_DB_NAME} not found on source instance!`);
        return;
    }

    const sourceDb = sourceClient.db(SOURCE_DB_NAME);
    const targetDb = targetClient.db(TARGET_DB_NAME);

    // 1. Clean Target Database
    console.log(`Cleaning target database: ${TARGET_DB_NAME} on target instance...`);
    await targetDb.dropDatabase();

    // 2. Migrate Items
    console.log('Migrating items...');
    const sourceItems = await sourceDb.collection('item').find({}).toArray();
    if (sourceItems.length > 0) {
      await targetDb.collection('item').insertMany(sourceItems);
      console.log(`Inserted ${sourceItems.length} items.`);
    }

    // 3. Migrate Time
    console.log('Migrating time periods...');
    const sourceTime = await sourceDb.collection('time').find({}).toArray();
    if (sourceTime.length > 0) {
      await targetDb.collection('time').insertMany(sourceTime);
      console.log(`Inserted ${sourceTime.length} time periods.`);
    }

    // 4. Migrate Fact Data with Normalization
    console.log('Migrating and normalizing fact data...');
    
    // Create maps for quick lookup
    const items = await targetDb.collection('item').find({}).toArray();
    const times = await targetDb.collection('time').find({}).toArray();

    const itemMap = new Map();
    items.forEach(item => {
      itemMap.set(item.Ranges, item._id);
    });

    const timeMap = new Map();
    times.forEach(t => {
      // Assuming 'Day' is a unique identifier in the time collection
      // We check if it's a Date object or a string
      const dayKey = t.Day instanceof Date ? t.Day.toISOString() : t.Day;
      timeMap.set(dayKey, t._id);
    });

    const sourceFacts = await sourceDb.collection('fact_data').find({}).toArray();
    console.log(`Found ${sourceFacts.length} source fact records.`);
    
    // Debugging: show some map keys
    const itemKeys = Array.from(itemMap.keys()).slice(0, 5);
    const timeKeys = Array.from(timeMap.keys()).slice(0, 5);
    console.log('Item Map Keys (sample):', itemKeys);
    console.log('Time Map Keys (sample):', timeKeys);

    const normalizedFacts = [];

    let missingItems = 0;
    let missingTime = 0;

    for (let j = 0; j < sourceFacts.length; j++) {
      const fact = sourceFacts[j] as unknown as SourceFact;
      const dayKey = fact.Day instanceof Date ? fact.Day.toISOString() : fact.Day;
      const itemId = itemMap.get(fact.Ranges);
      const timeId = timeMap.get(dayKey);

      if (j < 5) {
        console.log(`Checking fact ${j}: Range="${fact.Ranges}", Day="${dayKey}" -> itemId=${!!itemId}, timeId=${!!timeId}`);
      }

      if (itemId && timeId) {
        normalizedFacts.push(normalizeFactRecord(fact, itemId, timeId));
      } else {
        if (!itemId) missingItems++;
        if (!timeId) missingTime++;
      }
    }

    if (normalizedFacts.length > 0) {
      console.log(`Normalized ${normalizedFacts.length} fact records. Starting insertion...`);
      // Insert in chunks to avoid payload size issues
      const chunkSize = 5000;
      for (let i = 0; i < normalizedFacts.length; i += chunkSize) {
        const chunk = normalizedFacts.slice(i, i + chunkSize);
        await targetDb.collection('fact_data').insertMany(chunk);
      }
      console.log(`Inserted ${normalizedFacts.length} normalized fact records.`);
    }

    if (missingItems > 0 || missingTime > 0) {
      console.warn(`Warning: Skipped ${missingItems} records due to missing item mapping and ${missingTime} records due to missing time mapping.`);
    }

    // 5. Create Combined View
    console.log('Creating combined view...');
    await targetDb.createCollection('combined_fact_view', {
      viewOn: 'fact_data',
      pipeline: [
        {
          $lookup: {
            from: 'item',
            localField: 'item_id',
            foreignField: '_id',
            as: 'item_details'
          }
        },
        { $unwind: '$item_details' },
        {
          $lookup: {
            from: 'time',
            localField: 'time_id',
            foreignField: '_id',
            as: 'time_details'
          }
        },
        { $unwind: '$time_details' },
        {
          $project: {
            _id: 1,
            planned_sales: 1,
            is_override: 1,
            updated_at: 1,
            planned_margin: 1,
            gross_sales: 1,
            net_sales: 1,
            gross_profit: 1,
            BusinessUnit: '$item_details.BusinessUnit',
            Department: '$item_details.Department',
            Ranges: '$item_details.Ranges',
            Year: '$time_details.Year',
            Quarter: '$time_details.Quarter',
            Month: '$time_details.Month',
            Day: '$time_details.Day'
          }
        }
      ]
    });
    console.log('Combined view created successfully.');

    console.log('Migration completed successfully!');

  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await sourceClient.close();
    await targetClient.close();
  }
}

runMigration();
