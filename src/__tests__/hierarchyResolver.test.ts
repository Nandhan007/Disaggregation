import { HierarchyResolver } from '../services/hierarchyResolver';
import axios from 'axios';
import { DisaggInput, OpenLStrategy, SalesFact } from '../types';

jest.mock('axios');

describe('HierarchyResolver', () => {
  let resolver: HierarchyResolver;

  beforeEach(() => {
    resolver = new HierarchyResolver();
    process.env.DRUID_URL = 'http://test-druid/v2/sql';
    process.env.DRUID_DATASOURCE = 'test_source';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should build a dynamic WHERE clause and POST to Druid fetching SalesFacts', async () => {
    const input: DisaggInput = {
      targetValue: 100,
      data_source: 'mongo_source', // Should NOT be used for Druid
      target_measure: 'planned_sales',
      dimensions: {
        BusinessUnit: 'BU1',
        Year: '2024'
      }
    };

    const strategy: OpenLStrategy = {
      spreading_type: 'WEIGHTED',
      basis_measure: 'gross_sales',
      constraints: []
    };

    const mockResponse = {
      data: [
        { _id: '123', isoverride: false, version: 1, planned_sales: 10, gross_sales: 100 },
        { _id: '456', isoverride: true, version: 2, planned_sales: 20, gross_sales: 200 }
      ]
    };

    (axios.post as jest.Mock).mockResolvedValue(mockResponse);

    const records = await resolver.fetchTargetRecords(input, strategy);

    expect(records).toEqual(mockResponse.data);
    expect(axios.post).toHaveBeenCalledTimes(1);

    const callArgs = (axios.post as jest.Mock).mock.calls[0];
    expect(callArgs[0]).toBe('http://test-druid/v2/sql');
    
    const query = callArgs[1].query as string;
    
    // Verify WHERE clause
    expect(query).toContain(`WHERE "BusinessUnit" = 'BU1' AND "Year" = '2024'`);
    expect(query).toContain(`GROUP BY "_id"`);
    expect(query).toContain(`FROM "test_source"`); // Should use env var
    expect(query).toContain(`LATEST_BY("planned_sales"`);
    expect(query).toContain(`LATEST_BY("gross_sales"`);
  });

  it('should throw an error if Druid query fails', async () => {
    const input: DisaggInput = {
      targetValue: 100,
      data_source: 'mongo_source',
      dimensions: {
        BusinessUnit: 'BU1'
      }
    };

    const strategy: OpenLStrategy = {
      spreading_type: 'EQUAL',
      basis_measure: null,
      constraints: []
    };

    (axios.post as jest.Mock).mockRejectedValue(new Error('Network error'));

    await expect(resolver.fetchTargetRecords(input, strategy)).rejects.toThrow('Druid query failed: Network error');
  });
});
