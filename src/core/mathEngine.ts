import { OpenLStrategy, SalesFact, DisaggInput } from '../types';
import { AllocationStrategy } from '../plugins/strategies';

export class MathEngine {
  private strategies: Map<string, AllocationStrategy> = new Map();

  constructor() {}

  /**
   * Registers a custom allocation strategy.
   * Allows the engine to be extended without modifying core logic.
   */
  public registerStrategy(name: string, strategy: AllocationStrategy): void {
    this.strategies.set(name.toUpperCase(), strategy);
  }

  /**
   * Applies vectorized computation for disaggregation directly on fetched Druid records.
   */
  public compute(
    input: DisaggInput,
    strategy: OpenLStrategy,
    records: SalesFact[]
  ): SalesFact[] {
    console.log(`[MathEngine] Starting compute for ${records.length} records. Strategy: ${strategy.spreading_type}`);
    const totalNodes = records.length;
    if (totalNodes === 0) return [];

    const measure = (input.target_measure as keyof SalesFact) || 'planned_sales';
    
    // Calculate overrides
    let totalOverrideValue = 0;
    let overrideCount = 0;

    const nodesToProcess: SalesFact[] = [];

    for (const record of records) {
      // Druid might return 'false' as a string, which evaluates to true in JS.
      const overrideVal = record.isoverride as any;
      const isOverride = 
        overrideVal === true || 
        overrideVal === 'true' || 
        overrideVal === 1 || 
        overrideVal === '1';

      if (isOverride) {
        totalOverrideValue += Number(record[measure]) || 0;
        overrideCount++;
      } else {
        nodesToProcess.push(record);
      }
    }

    console.log(`[MathEngine] Overrides found: ${overrideCount}. Nodes to process: ${nodesToProcess.length}`);

    const remainingValue = input.targetValue - totalOverrideValue;
    const remainingNodes = totalNodes - overrideCount;

    if (remainingNodes === 0) {
      return [];
    }

    const allocationStrategy = this.strategies.get(strategy.spreading_type.toUpperCase());
    
    if (!allocationStrategy) {
      throw new Error(`Unsupported strategy: ${strategy.spreading_type}`);
    }

    // Apply the dynamically loaded strategy.
    // The strategy will mutate nodesToProcess in place.
    allocationStrategy.apply(
      input,
      strategy,
      nodesToProcess,
      measure,
      remainingValue,
      remainingNodes
    );

    // Apply constraints efficiently via mutation
    this.applyConstraintsInPlace(nodesToProcess, strategy, measure);
    return nodesToProcess;
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
