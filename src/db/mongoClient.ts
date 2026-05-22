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

  getFactCollection(dataSource: string): Collection<any> {
    return this.getCollection<any>(dataSource);
  }

  /**
   * Performs bulk upsert for fact data, updating ONLY the targetMeasure
   */
  async bulkUpsertSalesFact(records: SalesFact[], dataSource: string, targetMeasure: string) {
    const collection = this.getFactCollection(dataSource);

    const operations: AnyBulkWriteOperation<any>[] = records.map((record) => {
      const { _id, version } = record;
      
      const updatePayload: any = {
        updated_at: new Date()
      };
      
      updatePayload[targetMeasure] = record[targetMeasure as keyof SalesFact];
      
      return {
        updateOne: {
          filter: {
            _id: new ObjectId(_id)
          },
          update: {
            $set: updatePayload,
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
