import { AllocationStrategy } from '.';
import { SalesFact, DisaggInput, OpenLStrategy } from '../../types';

export class CustomStrategy implements AllocationStrategy {
  apply(
    input: DisaggInput,
    strategy: OpenLStrategy,
    nodesToProcess: SalesFact[],
    measure: keyof SalesFact,
    remainingValue: number,
    remainingNodes: number
  ): void {
    console.log('[Plugin] Executing CustomStrategy: distributing and adding 10% bonus!');
    const baseValue = remainingValue / remainingNodes;
    
    // Example of a custom business logic: apply equal split + 10% bonus
    for (const record of nodesToProcess) {
      (record as any)[measure] = baseValue * 1.10;
    }
  }
}
