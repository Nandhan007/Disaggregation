import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'disagg_normalized_db';

async function verifyDatabase() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    console.log(`Connected to MongoDB at ${MONGO_URI}`);
    const db = client.db(DB_NAME);

    console.log(`\n--- Verification for Database: ${DB_NAME} ---`);

    // Check collections
    const collections = await db.listCollections().toArray();
    console.log('Collections present:', collections.map(c => c.name));

    // Summary counts
    const factCount = await db.collection('fact_data').countDocuments();
    const itemCount = await db.collection('item').countDocuments();
    const timeCount = await db.collection('time').countDocuments();

    console.log(`\nSummary Statistics:`);
    console.table([
      { Collection: 'fact_data', Count: factCount },
      { Collection: 'item', Count: itemCount },
      { Collection: 'time', Count: timeCount }
    ]);

    // Sample from Combined View
    console.log(`\nSample from combined_fact_view (joined data):`);
    const viewResults = await db.collection('combined_fact_view').find().limit(5).toArray();
    console.table(viewResults.map(r => ({
      BU: r.BusinessUnit,
      Dept: r.Department,
      Range: r.Ranges,
      Year: r.Year,
      Month: r.Month,
      Sales: r.planned_sales,
      Margin: r.planned_margin
    })));

    // Sales distribution (simplified since scenario is removed)
    const salesPipeline = [
      {
        $group: {
          _id: null,
          totalCount: { $sum: 1 },
          avgValue: { $avg: "$planned_sales" }
        }
      }
    ];

    const salesResults = await db.collection('fact_data').aggregate(salesPipeline).toArray();
    console.log("\nOverall Sales Statistics:");
    console.table(salesResults);

  } catch (error) {
    console.error('Error verifying database:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB.');
  }
}

verifyDatabase();
