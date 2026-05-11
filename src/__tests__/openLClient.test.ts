import { OpenLClient } from '../services/openLClient';
import { DisaggInput } from '../types';

describe('OpenLClient', () => {
  let client: OpenLClient;

  beforeEach(() => {
    process.env.OPENL_URL = 'http://mock-url/api';
    client = new OpenLClient();
    // Mock global fetch
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetModules();
  });

  it('should parse WEIGHTED strategy from array response', async () => {
    const mockResponse = [
      {
        Allocation_method: 'WEIGHTED',
        basisMeasure: 'planned_sales',
        constraints: ['MIN_ZERO', 'ROUND_OFF'],
        ruleName: 'Weighted_Average',
        version: '1'
      }
    ];

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const input: DisaggInput = {
      targetValue: 100,
      target_measure: 'planned_sales',
      dimensions: { item_id: 'BU1', time_id: '2022' }
    };

    const strategy = await client.fetchStrategy(input);

    expect(strategy.spreading_type).toBe('WEIGHTED');
    expect(strategy.basis_measure).toBe('planned_sales');
    expect(strategy.constraints).toContain('ROUND_OFF');
    expect(strategy.metadata?.rule_id).toBe('Weighted_Average');
  });

  it('should throw error if response is empty', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    const input: DisaggInput = {
      targetValue: 100,
      target_measure: 'planned_sales',
      dimensions: { item_id: 'BU1', time_id: '2022' }
    };

    await expect(client.fetchStrategy(input)).rejects.toThrow('[OpenL] Empty or invalid response from Rule Engine');
  });

  it('should throw error if target_measure is missing', async () => {
    const input: any = {
      targetValue: 100,
      dimensions: { item_id: 'BU1', time_id: '2022' }
    };

    await expect(client.fetchStrategy(input)).rejects.toThrow('[OpenL] target_measure is required in DisaggInput');
  });

  it('should throw error if OPENL_URL is missing', async () => {
    delete process.env.OPENL_URL;
    const clientNoUrl = new OpenLClient();
    
    const input: DisaggInput = {
      targetValue: 100,
      target_measure: 'planned_sales',
      dimensions: { item_id: 'BU1', time_id: '2022' }
    };

    await expect(clientNoUrl.fetchStrategy(input)).rejects.toThrow('[OpenL] OPENL_URL environment variable is not defined');
  });
});

