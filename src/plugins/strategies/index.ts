import { SalesFact, DisaggInput, OpenLStrategy } from '../../types';

export interface AllocationStrategy {
  /**
   * Applies the specific allocation logic to the nodes.
   * Modifies the nodesToProcess array in place.
   */
  apply(
    input: DisaggInput,
    strategy: OpenLStrategy,
    nodesToProcess: SalesFact[],
    measure: keyof SalesFact,
    remainingValue: number,
    remainingNodes: number
  ): void;
}
