import { ObjectId } from 'mongodb';
import { normalizeFactRecord } from '../core/normalization';

describe('Normalization Logic', () => {
  it('should correctly normalize a source fact record', () => {
    const itemId = new ObjectId();
    const timeId = new ObjectId();
    const sourceFact = {
      Ranges: 'Test Range',
      Day: '2024-01-01',
      Sales: 500,
      Margin: 200,
      gross_sales: 1000,
      net_sales: 800,
      gross_profit: 300
    };

    const result = normalizeFactRecord(sourceFact, itemId, timeId);

    expect(result.item_id).toBe(itemId);
    expect(result.time_id).toBe(timeId);
    expect(result.planned_sales).toBe(500);
    expect(result.planned_margin).toBe(200);
    expect(result.gross_sales).toBe(1000);
    expect(result.is_override).toBe(false);
    expect(result.version).toBe(0);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should use provided is_override if present', () => {
    const itemId = new ObjectId();
    const timeId = new ObjectId();
    const sourceFact = {
      Ranges: 'Test Range',
      Day: '2024-01-01',
      is_override: true,
      Sales: 1000
    };

    const result = normalizeFactRecord(sourceFact, itemId, timeId);

    expect(result.is_override).toBe(true);
    expect(result.planned_sales).toBe(1000);
  });

  it('should handle missing sales value with default 0', () => {
    const itemId = new ObjectId();
    const timeId = new ObjectId();
    const sourceFact = {
      Ranges: 'Test Range',
      Day: '2024-01-01'
    };

    const result = normalizeFactRecord(sourceFact, itemId, timeId);

    expect(result.planned_sales).toBe(0);
    expect(result.gross_sales).toBe(0);
  });
});
