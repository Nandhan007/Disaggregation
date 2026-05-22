import { AllocationStrategy } from './index';
import { SalesFact, DisaggInput, OpenLStrategy } from '../../types';

export class WeightedStrategy implements AllocationStrategy {
  apply(
    input: DisaggInput,
    strategy: OpenLStrategy,
    nodesToProcess: SalesFact[],
    measure: keyof SalesFact,
    remainingValue: number,
    remainingNodes: number
  ): void {
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
    }
  }
}
