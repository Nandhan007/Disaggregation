import { AllocationStrategy } from './index';
import { SalesFact, DisaggInput, OpenLStrategy } from '../../types';

export class EqualStrategy implements AllocationStrategy {
  apply(
    input: DisaggInput,
    strategy: OpenLStrategy,
    nodesToProcess: SalesFact[],
    measure: keyof SalesFact,
    remainingValue: number,
    remainingNodes: number
  ): void {
    const valuePerNode = remainingValue / remainingNodes;

    for (const record of nodesToProcess) {
      (record as any)[measure] = valuePerNode;
    }
  }
}
