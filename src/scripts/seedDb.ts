import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'disagg_normalized_db';

async function seedDatabase() {
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log(`Connected to MongoDB at ${MONGO_URI}`);
    const db = client.db(DB_NAME);

    // Clear existing data
    console.log('Clearing existing collections...');
    await db.collection('item').deleteMany({});
    await db.collection('time').deleteMany({});
    await db.collection('fact_data').deleteMany({});
    try { await db.collection('combined_fact_view').drop(); } catch (e) {}

    // 1. Seed Items
    console.log('Seeding items...');
    const items = [];
    const businessUnits = ['BU1', 'BU2', 'BU3', 'BU4', 'BU5'];
    const departments = ['Dept_A', 'Dept_B', 'Dept_C'];
    
    for (const bu of businessUnits) {
      for (const dept of departments) {
        for (let i = 1; i <= 20; i++) {
          items.push({
            _id: new ObjectId(),
            BusinessUnit: bu,
            Department: dept,
            Ranges: `${bu}_${dept}_ITEM_${i}`
          });
        }
      }
    }
    await db.collection('item').insertMany(items);
    console.log(`Inserted ${items.length} items.`);

    // 2. Seed Time
    console.log('Seeding time periods...');
    const timePeriods = [];
    const year = 2024;
    const startDate = new Date(year, 0, 1);
    
    for (let d = 0; d < 366; d++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + d);
      if (date.getFullYear() !== year) break;

      const month = date.getMonth() + 1;
      const quarter = Math.floor((month - 1) / 3) + 1;
      
      timePeriods.push({
        _id: new ObjectId(),
        Year: year,
        Quarter: `Q${quarter}`,
        Month: month,
        Day: date.toISOString().split('T')[0]
      });
    }
    await db.collection('time').insertMany(timePeriods);
    console.log(`Inserted ${timePeriods.length} time periods.`);

    // 3. Seed Fact Data
    console.log('Seeding fact data...');
    const timestamp = new Date();
    const TOTAL_RECORDS = 100000;
    const BATCH_SIZE = 10000;
    let recordsInserted = 0;

    for (let i = 0; i < TOTAL_RECORDS; i += BATCH_SIZE) {
      const batch = [];
      const end = Math.min(i + BATCH_SIZE, TOTAL_RECORDS);

      for (let j = i; j < end; j++) {
        const item = items[j % items.length];
        const time = timePeriods[j % timePeriods.length];
        
        // Randomize some overrides
        const isOverride = Math.random() < 0.05;

        batch.push({
          item_id: item._id,
          time_id: time._id,
          planned_sales: isOverride ? Math.floor(Math.random() * 10000) : Math.floor(Math.random() * 500) + 10,
          is_override: isOverride,
          updated_at: timestamp,
          version: 1,
          // Including other fields for consistency with combined view if needed
          planned_margin: Math.random() * 0.3,
          gross_sales: 0,
          net_sales: 0,
          gross_profit: 0
        });
      }

      const result = await db.collection('fact_data').insertMany(batch);
      recordsInserted += result.insertedCount;
      console.log(`Inserted ${recordsInserted} / ${TOTAL_RECORDS} records...`);
    }

    // 4. Setup Combined View if it doesn't exist
    // We can just call it here or rely on the other script. 
    // To make this robust, let's ensure it exists.
    const collections = await db.listCollections({ name: 'combined_fact_view' }).toArray();
    if (collections.length === 0) {
      console.log('Creating combined view...');
      await db.createCollection('combined_fact_view', {
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
              item_id: 1,
              time_id: 1,
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
      console.log('Combined view created.');
    }

    console.log(`Successfully completed seeding ${recordsInserted} records.`);

  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    await client.close();
    console.log('Disconnected from MongoDB.');
  }
}

seedDatabase();
