import { ObjectId } from 'mongodb';

export interface SourceFact {
  Ranges: string;
  Day: string | Date;
  Sales?: number;
  Margin?: number;
  gross_sales?: number;
  net_sales?: number;
  gross_profit?: number;
  scenario_id?: string;
  isoverride?: boolean;
  location_id?: string;
}

export interface NormalizedFact {
  item_id: ObjectId;
  time_id: ObjectId;
  planned_sales: number;
  planned_margin?: number;
  gross_sales: number;
  net_sales: number;
  gross_profit: number;
  isoverride: boolean;
  updated_at: Date;
  version: number;
}

export function normalizeFactRecord(
  fact: SourceFact,
  itemId: ObjectId,
  timeId: ObjectId
): NormalizedFact {
  return {
    item_id: itemId,
    time_id: timeId,
    planned_sales: fact.Sales || 0,
    planned_margin: fact.Margin,
    gross_sales: fact.gross_sales || 0,
    net_sales: fact.net_sales || 0,
    gross_profit: fact.gross_profit || 0,
    isoverride: fact.isoverride || false,
    updated_at: new Date(),
    version: 0
  };
}
