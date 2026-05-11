import { DBClient } from '../db/mongoClient';
import { LeafNode, DisaggInput } from '../types';

export class HierarchyResolver {
  private dbClient: DBClient;

  constructor(dbClient: DBClient) {
    this.dbClient = dbClient;
  }

  /**
   * Resolves high-level input to leaf nodes by querying existing records in the fact table.
   * This ensures we only process data that actually exists.
   */
  async resolveToLeaves(input: DisaggInput): Promise<LeafNode[]> {
    const { time_id, item_id } = input.dimensions;
    console.log(`[Hierarchy] Resolving leaves for item_id: ${item_id}, time_id: ${time_id}`);
    
    // 1. Resolve Time Leaves (e.g., Year -> Months/Days)
    const timeQuery: any = {};
    if (!isNaN(Number(time_id))) {
      timeQuery.Year = Number(time_id);
    } else if (time_id.startsWith('Q')) {
      timeQuery.Quarter = time_id;
    } else {
      timeQuery.Month = time_id;
    }

    const times = await this.dbClient.getTimeCollection().find(timeQuery).toArray();
    const timeIds = times.map(t => t._id);

    // 2. Resolve Item Leaves (e.g., BU/Dept -> Items)
    // Check if item_id matches an item directly, or a BusinessUnit/Department
    const itemQuery: any = {
      $or: [
        { _id: item_id },
        { BusinessUnit: item_id },
        { Department: item_id }
      ]
    };

    const items = await this.dbClient.getItemCollection().find(itemQuery).toArray();
    const itemIds = items.map(i => i._id);

    console.log(`[Hierarchy] Filter resolved to ${timeIds.length} time periods and ${itemIds.length} items.`);

    if (timeIds.length === 0 || itemIds.length === 0) {
      return [];
    }

    // 3. Find existing records in the fact table matching these dimensions
    // This is the "Existing record count" approach
    const existingFactRecords = await this.dbClient.getFactCollection().find({
      item_id: { $in: itemIds },
      time_id: { $in: timeIds }
    }).project({ item_id: 1, time_id: 1 }).toArray();

    const leaves: LeafNode[] = existingFactRecords.map(rec => ({
      item_id: rec.item_id.toString(),
      time_id: rec.time_id.toString()
    }));

    console.log(`[Hierarchy] Found ${leaves.length} existing leaf nodes in fact table.`);
    return leaves;
  }
}
