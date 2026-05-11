import { MongoClient, Collection, AnyBulkWriteOperation, ObjectId } from 'mongodb';
import { SalesFact } from '../types';

export class DBClient {
  private client: MongoClient;
  private dbName: string;

  constructor(uri: string, dbName: string = 'disagg_normalized_db') {
    this.client = new MongoClient(uri);
    this.dbName = dbName;
  }

  async connect() {
    await this.client.connect();
    console.log(`Connected to MongoDB: ${this.dbName}`);
  }

  async disconnect() {
    await this.client.close();
  }

  getCollection<T>(name: string): Collection<any> {
    return this.client.db(this.dbName).collection<any>(name);
  }

  getFactCollection(): Collection<any> {
    return this.getCollection<any>('fact_data');
  }

  getItemCollection(): Collection<any> {
    return this.getCollection<any>('item');
  }

  getTimeCollection(): Collection<any> {
    return this.getCollection<any>('time');
  }

  /**
   * Fetches existing records for given leaf nodes and scenario
   */
  async fetchExistingRecords(leafNodes: any[]): Promise<SalesFact[]> {
    const collection = this.getFactCollection();
    const filters = leafNodes.map(leaf => ({
      item_id: new ObjectId(leaf.item_id),
      time_id: new ObjectId(leaf.time_id)
    }));

    if (filters.length === 0) return [];

    // Use $or for bulk fetch
    const records = await collection.find({ $or: filters }).toArray();
    return records.map(r => ({
      ...r,
      item_id: r.item_id.toString(),
      time_id: r.time_id.toString()
    })) as SalesFact[];
  }

  /**
   * Performs bulk upsert for fact data
   */
  async bulkUpsertSalesFact(records: any[]) {
    const collection = this.getFactCollection();

    const operations: AnyBulkWriteOperation<any>[] = records.map((record) => {
      // Destructure to exclude version and IDs from $set to avoid conflicts and type issues
      const { _id, item_id, time_id, version, ...updateData } = record;
      
      return {
        updateOne: {
          filter: {
            item_id: new ObjectId(item_id),
            time_id: new ObjectId(time_id)
          },
          update: {
            $set: {
              ...updateData,
              updated_at: new Date()
            },
            // VERSIONING: Automatically increment the version field by 1 for every update.
            // If the record is being upserted for the first time, it starts at 1.
            $inc: { version: 1 }
          },
          upsert: true
        }
      };
    });

    if (operations.length === 0) return { matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };

    const result = await collection.bulkWrite(operations, { ordered: false });
    return result;
  }
}
