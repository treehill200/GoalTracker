/**
 * Pluggable integration adapters. Each one can connect (OAuth/upload/etc.),
 * sync raw records, and map them onto the user's metrics as entries.
 */
import type { PublicFeatures } from "@/lib/config";
import type { DataSource, IntegrationProvider } from "@/lib/data/types";

export interface MappedEntry {
  metricId: string;
  value: number;
  date: string;
  source: DataSource;
  note: string | null;
}

export interface IntegrationAdapter<Raw, Mapping> {
  id: IntegrationProvider;
  name: string;
  description: string;
  isEnabled(features: PublicFeatures): boolean;
  /** Start the connection (redirect to OAuth, open a file picker, …). */
  connect(): Promise<void>;
  /** Fetch raw records from the provider (or from an uploaded file). */
  sync(input?: unknown): Promise<Raw[]>;
  /** Turn raw records into metric entries using the user's mapping. */
  mapToMetrics(raw: Raw[], mapping: Mapping): MappedEntry[];
}
