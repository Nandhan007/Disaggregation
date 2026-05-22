import { OpenLStrategy, SalesFact, DisaggInput } from '../types';

export class MathEngine {
  /**
   * Applies vectorized computation for disaggregation directly on fetched Druid records.
   */
  public compute(
    input: DisaggInput,
    strategy: OpenLStrategy,
    records: SalesFact[]
  ): SalesFact[] {
    const totalNodes = records.length;
    if (totalNodes === 0) return [];

    const measure = (input.target_measure as keyof SalesFact) || 'planned_sales';
    
    // Calculate overrides
    let totalOverrideValue = 0;
    let overrideCount = 0;

    const nodesToProcess: SalesFact[] = [];

    for (const record of records) {
      if (record.isoverride) {
        totalOverrideValue += (record[measure] as number) || 0;
        overrideCount++;
      } else {
        nodesToProcess.push(record);
      }
    }

    const remainingValue = input.targetValue - totalOverrideValue;
    const remainingNodes = totalNodes - overrideCount;

    if (remainingNodes === 0) {
      return [];
    }

    const results: SalesFact[] = [];

    if (strategy.spreading_type === 'EQUAL') {
      const valuePerNode = remainingValue / remainingNodes;

      for (const record of nodesToProcess) {
        (record as any)[measure] = valuePerNode;
        results.push(record);
      }
    } else if (strategy.spreading_type === 'WEIGHTED') {
      let totalBasis = 0;
      const basisColumn = (strategy.basis_measure as keyof SalesFact) || measure;

      for (const record of nodesToProcess) {
        const basisVal = record[basisColumn] as number;
        // Fix for 0 basis bug: explicitly check undefined/null
        const basis = (basisVal !== undefined && basisVal !== null) ? basisVal : 1;
        totalBasis += basis;
        (record as any)._tempBasis = basis;
      }

      for (const record of nodesToProcess) {
        const basis = (record as any)._tempBasis;
        delete (record as any)._tempBasis;

        const allocatedValue = totalBasis === 0 ? 0 : (basis / totalBasis) * remainingValue;
        (record as any)[measure] = allocatedValue;
        results.push(record);
      }
    } else if (strategy.spreading_type === 'COPY') {
      for (const record of nodesToProcess) {
        (record as any)[measure] = input.targetValue;
        results.push(record);
      }
    } else {
      throw new Error(`Unsupported strategy: ${strategy.spreading_type}`);
    }

    // Apply constraints efficiently via mutation
    this.applyConstraintsInPlace(results, strategy, measure);
    return results;
  }

  /**
   * Applies post-computation constraints like minimum/maximum values in-place.
   */
  private applyConstraintsInPlace(results: SalesFact[], strategy: OpenLStrategy, measure: keyof SalesFact): void {
    if (!strategy.constraints || strategy.constraints.length === 0) return;

    for (const record of results) {
      let value = record[measure] as number;

      for (const constraint of strategy.constraints) {
        if (constraint === 'MIN_ZERO') {
          value = Math.max(0, value);
        }
        if (constraint === 'ROUND_OFF') {
          value = Math.round(value * 1000) / 1000;
        }
      }

      (record as any)[measure] = value;
    }
  }
}
