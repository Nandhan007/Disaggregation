import { OpenLStrategy, DisaggInput } from '../types';

export class OpenLClient {
  private apiUrl: string | undefined;

  constructor() {
    this.apiUrl = process.env.OPENL_URL + '/MFP_Project-info/disaggregation-rules/getStrategyByTargetMeasure';
  }

  /**
   * Fetches the rule strategy from OpenL Tablets Rule Engine.
   * Throws an error if the API call fails or configuration is missing.
   */
  async fetchStrategy(inputContext: DisaggInput): Promise<OpenLStrategy> {
    const targetMeasure = inputContext.target_measure;

    if (!targetMeasure) {
      throw new Error('[OpenL] target_measure is required in DisaggInput');
    }

    if (!this.apiUrl) {
      throw new Error('[OpenL] OPENL_URL environment variable is not defined');
    }

    console.log(`[OpenL] Fetching strategy for measure: ${targetMeasure} from ${this.apiUrl}`);

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ targetMeasure }),
      });

      if (!response.ok) {
        throw new Error(`[OpenL] API returned error status: ${response.status}`);
      }

      const data = await response.json() as any;
      console.log('[OpenL] API Response received:', JSON.stringify(data));

      if (!data || !Array.isArray(data) || data.length === 0) {
        throw new Error('[OpenL] Empty or invalid response from Rule Engine');
      }

      // Handle the array response as verified from the live API
      const result = data[0];

      const spreading_type = result.Allocation_method || 'EQUAL';

      return {
        spreading_type: spreading_type,
        basis_measure: result.basisMeasure || (spreading_type === 'WEIGHTED' ? 'planned_sales' : null),
        constraints: result.constraints || [],
        metadata: {
          rule_id: result.ruleName || 'UNKNOWN',
          version: result.version?.toString() || '1.0.0',
          table_name: 'OpenLAllocationRules'
        }
      };
    } catch (error: any) {
      console.error('[OpenL] Execution error:', error.message);
      throw error; // Re-throw to be handled by the caller (server.ts)
    }
  }
}

