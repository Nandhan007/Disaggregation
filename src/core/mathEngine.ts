import { LeafNode, OpenLStrategy, SalesFact, DisaggInput } from '../types';

export class MathEngine {
  /**
   * Applies vectorized computation for disaggregation.
   * Modifies existing records if they exist, or creates new array.
   */
  public compute(
    input: DisaggInput,
    strategy: OpenLStrategy,
    leafNodes: LeafNode[],
    existingData: SalesFact[]
  ): SalesFact[] {
    const dataMap = new Map<string, SalesFact>();
    
    // Index existing data for quick lookup
    for (const record of existingData) {
      const key = `${record.item_id}-${record.time_id}`;
      dataMap.set(key, record);
    }

    const totalNodes = leafNodes.length;
    if (totalNodes === 0) return [];

    const measure = (input.target_measure as keyof SalesFact) || 'planned_sales';
    
    // Calculate overrides
    let totalOverrideValue = 0;
    let overrideCount = 0;

    const nodesToProcess: { leaf: LeafNode, existing?: SalesFact }[] = [];

    for (const leaf of leafNodes) {
      const key = `${leaf.item_id}-${leaf.time_id}`;
      const existing = dataMap.get(key);
      
      if (existing && existing.is_override) {
        totalOverrideValue += (existing[measure] as number) || 0;
        overrideCount++;
      } else {
        nodesToProcess.push({ leaf, existing });
      }
    }

    const remainingValue = input.targetValue - totalOverrideValue;
    const remainingNodes = totalNodes - overrideCount;

    if (remainingNodes === 0) {
      return [];
    }

    const results: SalesFact[] = [];
    const timestamp = new Date();

    if (strategy.spreading_type === 'EQUAL') {
      const valuePerNode = remainingValue / remainingNodes;

      for (const { leaf, existing } of nodesToProcess) {
        const record: any = {
          item_id: leaf.item_id,
          time_id: leaf.time_id,
          is_override: false,
          updated_at: timestamp,
          version: existing ? existing.version : 0
        };
        record[measure] = valuePerNode;
        results.push(record as SalesFact);
      }
    } else if (strategy.spreading_type === 'WEIGHTED') {
      let totalBasis = 0;
      const nodesWithBasis: { node: { leaf: LeafNode, existing?: SalesFact }, basis: number }[] = [];

      const basisColumn = (strategy.basis_measure as keyof SalesFact) || measure;

      for (const node of nodesToProcess) {
        const basis = node.existing ? ((node.existing[basisColumn] as number) || 1) : 1;
        totalBasis += basis;
        nodesWithBasis.push({ node, basis });
      }

      for (const { node, basis } of nodesWithBasis) {
        const allocatedValue = totalBasis === 0 ? 0 : (basis / totalBasis) * remainingValue;
        
        const record: any = {
          item_id: node.leaf.item_id,
          time_id: node.leaf.time_id,
          is_override: false,
          updated_at: timestamp,
          version: node.existing ? node.existing.version : 0
        };
        record[measure] = allocatedValue;
        results.push(record as SalesFact);
      }
    } else if (strategy.spreading_type === 'COPY') {
      // COPY logic: Broadcast the targetValue to every leaf node
      // Useful for metrics like 'price' or 'status' where every child gets the same value
      for (const { leaf, existing } of nodesToProcess) {
        const record: any = {
          item_id: leaf.item_id,
          time_id: leaf.time_id,
          is_override: false,
          updated_at: timestamp,
          version: existing ? existing.version : 0
        };
        record[measure] = input.targetValue;
        results.push(record as SalesFact);
      }
    } else {
      throw new Error(`Unsupported strategy: ${strategy.spreading_type}`);
    }

    // Apply constraints (e.g. MIN_ZERO)
    return this.applyConstraints(results, strategy, measure);
  }

  /**
   * Applies post-computation constraints like minimum/maximum values.
   */
  private applyConstraints(results: SalesFact[], strategy: OpenLStrategy, measure: keyof SalesFact): SalesFact[] {
    if (!strategy.constraints || strategy.constraints.length === 0) return results;

    return results.map(record => {
      let value = record[measure] as number;

      for (const constraint of strategy.constraints) {
        if (constraint === 'MIN_ZERO') {
          value = Math.max(0, value);
        }
        if (constraint === 'ROUND_OFF') {
          value = Math.round(value * 1000) / 1000;
        }
        // Add more constraint logic here (e.g. MAX_VAL, ROUNDing)
      }

      return {
        ...record,
        [measure]: value
      };
    });
  }
}
