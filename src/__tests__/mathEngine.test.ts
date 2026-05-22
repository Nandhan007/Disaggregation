import { MathEngine } from '../core/mathEngine';
import { DisaggInput, OpenLStrategy, SalesFact } from '../types';
import { setupStrategies } from '../plugins/register';

describe('MathEngine', () => {
  let mathEngine: MathEngine;

  beforeEach(() => {
    mathEngine = new MathEngine();
    setupStrategies(mathEngine);
  });

  it('should split value equally among all nodes when strategy is EQUAL', () => {
    const input: DisaggInput = {
      targetValue: 1000,
      data_source: 'test_source',
      dimensions: {
        item_id: 'BU1',
        time_id: 'Q1'
      }
    };

    const strategy: OpenLStrategy = {
      spreading_type: 'EQUAL',
      basis_measure: null,
      constraints: []
    };

    const records: SalesFact[] = [
      { _id: '1', planned_sales: 0, isoverride: false, version: 1, updated_at: new Date() },
      { _id: '2', planned_sales: 0, isoverride: false, version: 1, updated_at: new Date() },
      { _id: '3', planned_sales: 0, isoverride: false, version: 1, updated_at: new Date() },
      { _id: '4', planned_sales: 0, isoverride: false, version: 1, updated_at: new Date() }
    ];

    const results = mathEngine.compute(input, strategy, records);

    expect(results.length).toBe(4);
    results.forEach(res => {
      expect(res.planned_sales).toBe(250); // 1000 / 4
      expect(res.isoverride).toBe(false);
      expect(res.version).toBe(1);
    });
  });

  it('should respect overrides and distribute remaining value equally', () => {
    const input: DisaggInput = {
      targetValue: 1000,
      data_source: 'test_source',
      dimensions: {
        item_id: 'BU1',
        time_id: 'Q1'
      }
    };

    const strategy: OpenLStrategy = {
      spreading_type: 'EQUAL',
      basis_measure: null,
      constraints: []
    };

    const records: SalesFact[] = [
      { _id: '1', planned_sales: 400, isoverride: true, updated_at: new Date(), version: 1 },
      { _id: '2', planned_sales: 0, isoverride: false, updated_at: new Date(), version: 1 },
      { _id: '3', planned_sales: 0, isoverride: false, updated_at: new Date(), version: 1 },
      { _id: '4', planned_sales: 0, isoverride: false, updated_at: new Date(), version: 1 }
    ];

    const results = mathEngine.compute(input, strategy, records);

    expect(results.length).toBe(3); // Only 3 rows need updating, since '1' is overridden
    
    // Remaining value = 1000 - 400 = 600. Distributed among 3 remaining nodes = 200 each.
    results.forEach(res => {
      expect(res.planned_sales).toBe(200); 
      expect(res._id).not.toBe('1');
    });
  });

  it('should correctly increment version if existing record is not overridden', () => {
    const input: DisaggInput = {
      targetValue: 100,
      data_source: 'test_source',
      dimensions: {
        item_id: 'BU1',
        time_id: 'Q1'
      }
    };

    const strategy: OpenLStrategy = {
      spreading_type: 'EQUAL',
      basis_measure: null,
      constraints: []
    };

    const records: SalesFact[] = [
      {
        _id: '1',
        planned_sales: 50,
        isoverride: false,
        updated_at: new Date(),
        version: 5
      }
    ];

    const results = mathEngine.compute(input, strategy, records);

    expect(results.length).toBe(1);
    expect(results[0].planned_sales).toBe(100);
    expect(results[0].version).toBe(5); // Version is maintained, incremented at DB level
  });

  it('should distribute value proportionally when strategy is WEIGHTED', () => {
    const input: DisaggInput = {
      targetValue: 1000,
      data_source: 'test_source',
      dimensions: { item_id: 'BU1', time_id: 'Q1' }
    };

    const strategy: OpenLStrategy = {
      spreading_type: 'WEIGHTED',
      basis_measure: 'gross_sales',
      constraints: []
    };

    const records: SalesFact[] = [
      { _id: '1', planned_sales: 0, gross_sales: 100, isoverride: false, version: 1, updated_at: new Date() },
      { _id: '2', planned_sales: 0, gross_sales: 400, isoverride: false, version: 1, updated_at: new Date() }
    ] as any[];

    const results = mathEngine.compute(input, strategy, records);

    expect(results.length).toBe(2);
    // Total Basis = 100 + 400 = 500.
    // '1' share = 100/500 * 1000 = 200.
    // '2' share = 400/500 * 1000 = 800.
    const r1 = results.find(r => r._id === '1');
    const r2 = results.find(r => r._id === '2');
    expect(r1?.planned_sales).toBe(200);
    expect(r2?.planned_sales).toBe(800);
  });

  it('should broadcast value to all nodes when strategy is COPY', () => {
    const input: DisaggInput = {
      targetValue: 50,
      data_source: 'test_source',
      dimensions: { item_id: 'BU1', time_id: 'Q1' },
      target_measure: 'unit_price'
    };

    const strategy: OpenLStrategy = {
      spreading_type: 'COPY',
      basis_measure: null,
      constraints: []
    };

    const records: SalesFact[] = [
      { _id: '1', unit_price: 0, isoverride: false, version: 1, updated_at: new Date() },
      { _id: '2', unit_price: 0, isoverride: false, version: 1, updated_at: new Date() }
    ] as any[];

    const results = mathEngine.compute(input, strategy, records);

    expect(results.length).toBe(2);
    results.forEach(res => {
      expect((res as any).unit_price).toBe(50);
    });
  });

  it('should apply MIN_ZERO constraint correctly', () => {
    const input: DisaggInput = {
      targetValue: -100,
      data_source: 'test_source',
      dimensions: { item_id: 'BU1', time_id: 'Q1' }
    };

    const strategy: OpenLStrategy = {
      spreading_type: 'EQUAL',
      basis_measure: null,
      constraints: ['MIN_ZERO']
    };

    const records: SalesFact[] = [
      { _id: '1', planned_sales: 0, isoverride: false, version: 1, updated_at: new Date() }
    ];

    const results = mathEngine.compute(input, strategy, records);

    expect(results.length).toBe(1);
    expect(results[0].planned_sales).toBe(0); // Clamped to 0 by constraint
  });

  it('should round off decimal values to 3 places when ROUND_OFF constraint is present', () => {
    const input: DisaggInput = {
      targetValue: 100,
      data_source: 'test_source',
      dimensions: { item_id: 'BU1', time_id: 'Q1' }
    };

    const strategy: OpenLStrategy = {
      spreading_type: 'EQUAL',
      basis_measure: null,
      constraints: ['ROUND_OFF']
    };

    const records: SalesFact[] = [
      { _id: '1', planned_sales: 0, isoverride: false, version: 1, updated_at: new Date() },
      { _id: '2', planned_sales: 0, isoverride: false, version: 1, updated_at: new Date() },
      { _id: '3', planned_sales: 0, isoverride: false, version: 1, updated_at: new Date() }
    ];

    const results = mathEngine.compute(input, strategy, records);

    // 100 / 3 = 33.333333333333336
    // ROUND_OFF should make it 33.333
    expect(results.length).toBe(3);
    results.forEach(res => {
      expect(res.planned_sales).toBe(33.333);
    });
  });
});
