import axios from 'axios';
import { DisaggInput, OpenLStrategy, SalesFact } from '../types';

export class HierarchyResolver {
  /**
   * Resolves high-level input to fact records by querying Druid directly for specific measures.
   */
  async fetchTargetRecords(input: DisaggInput, strategy: OpenLStrategy): Promise<SalesFact[]> {
    const druidUrl = process.env.DRUID_URL || 'http://localhost:8888/druid/v2/sql';
    const dataSource = process.env.DRUID_DATASOURCE || 'fact_depart_quarter'; // Using from env for Druid fetch

    console.log(`[Hierarchy] Resolving records via Druid for dimensions:`, JSON.stringify(input.dimensions));

    // Construct WHERE clause
    const conditions = Object.entries(input.dimensions)
      .map(([key, value]) => `"${key}" = '${value}'`)
      .join(' AND ');
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions}` : '';
    
    const targetMeasure = input.target_measure;
    const basisMeasure = strategy.basis_measure;
    
    let selectClause = `
      "_id",
      LATEST_BY("isoverride", __time) AS "isoverride",
      LATEST_BY("version", __time) AS "version",
      LATEST_BY("${targetMeasure}", __time) AS "${targetMeasure}"
    `;
    
    if (basisMeasure && basisMeasure !== targetMeasure) {
       selectClause += `, LATEST_BY("${basisMeasure}", __time) AS "${basisMeasure}"`;
    }

    const query = `
      SELECT ${selectClause}
      FROM "${dataSource}"
      ${whereClause}
      GROUP BY "_id"
      HAVING LATEST_BY("operation_type",__time) != 'delete'
    `;

    console.log(`[Hierarchy] Executing Druid SQL:\n${query}`);

    try {
      const response = await axios.post(druidUrl, { query }, {
        headers: { 'Content-Type': 'application/json' }
      });

      const records = response.data as SalesFact[];

      console.log(`[Hierarchy] Found ${records.length} matching fact records from Druid.`);
      return records;
    } catch (error: any) {
      console.error('[Hierarchy] Error querying Druid:', error.message);
      throw new Error(`Druid query failed: ${error.message}`);
    }
  }
}
