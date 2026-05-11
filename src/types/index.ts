export interface SalesFact {
  item_id: string;
  time_id: string;
  planned_sales: number;
  planned_margin?: number;
  gross_sales?: number;
  net_sales?: number;
  gross_profit?: number;
  unit_price?: number;
  is_override: boolean;
  updated_at: Date;
  version: number; // for optimistic locking
  [key: string]: any; // Allow for dynamic measures
}

export type AllocationMethod = 'EQUAL' | 'WEIGHTED' | 'COPY' | 'CUSTOM';

export interface OpenLStrategy {
  spreading_type: 'EQUAL' | 'WEIGHTED' | 'COPY';
  basis_measure: string | null;
  constraints: string[];
  metadata?: {
    rule_id: string;
    version: string;
    table_name?: string;
  };
}

export interface DisaggInput {
  targetValue: number;
  dimensions: {
    item_id: string; // High-level item or hierarchy node
    time_id: string; // High-level time, e.g. Year or Quarter
  };
  target_measure?: string; // e.g. 'planned_sales' or 'planned_margin'
  notes?: string;
}

export interface LeafNode {
  item_id: string;
  time_id: string;
}
