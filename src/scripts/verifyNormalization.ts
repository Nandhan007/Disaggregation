import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'disagg_normalized_db';

async function verify() {
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log(`Connected to MongoDB at ${MONGO_URI}`);
    const db = client.db(DB_NAME);

    const itemCollection = db.collection('item');
    const timeCollection = db.collection('time');
    const factCollection = db.collection('fact_data');
    const viewCollection = db.collection('combined_fact_view');

    const itemCount = await itemCollection.countDocuments();
    const timeCount = await timeCollection.countDocuments();
    const factCount = await factCollection.countDocuments();
    
    console.log(`--- Collection Counts ---`);
    console.log(`Items: ${itemCount}`);
    console.log(`Time Periods: ${timeCount}`);
    console.log(`Fact Records: ${factCount}`);

    console.log(`\n--- Schema Validation (fact_data) ---`);
    const sampleFact = await factCollection.findOne({});
    if (sampleFact) {
      console.log('Sample Fact Record:', JSON.stringify(sampleFact, null, 2));
      const hasLocation = 'location_id' in sampleFact;
      const hasScenario = 'scenario_id' in sampleFact;
      const hasSales = 'Sales' in sampleFact;
      const hasPlannedSales = 'planned_sales' in sampleFact;

      console.log(`Has location_id: ${hasLocation} (Expected: false)`);
      console.log(`Has scenario_id: ${hasScenario} (Expected: false)`);
      console.log(`Has Sales: ${hasSales} (Expected: false)`);
      console.log(`Has planned_sales: ${hasPlannedSales} (Expected: true)`);
    } else {
      console.log('No fact records found.');
    }

    console.log(`\n--- View Validation (combined_fact_view) ---`);
    const sampleView = await viewCollection.findOne({});
    if (sampleView) {
      console.log('Sample View Record:', JSON.stringify(sampleView, null, 2));
      console.log('View successfully joined with item and time details.');
    } else {
      console.log('No view records found or view creation failed.');
    }

  } catch (error) {
    console.error('Verification failed:', error);
  } finally {
    await client.close();
  }
}

verify();
