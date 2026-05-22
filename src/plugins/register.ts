import { MathEngine } from '../core/mathEngine';
import { EqualStrategy } from './strategies/EqualStrategy';
import { WeightedStrategy } from './strategies/WeightedStrategy';
import { CopyStrategy } from './strategies/CopyStrategy';
import { CustomStrategy } from './strategies/CustomStrategy';

export function setupStrategies(engine: MathEngine) {
  // Register core strategies
  engine.registerStrategy('EQUAL', new EqualStrategy());
  engine.registerStrategy('WEIGHTED', new WeightedStrategy());
  engine.registerStrategy('COPY', new CopyStrategy());

  // Register custom strategies
  engine.registerStrategy('CUSTOM', new CustomStrategy());
}
