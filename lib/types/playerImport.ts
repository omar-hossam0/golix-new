export interface PlayerImportError {
  row: number | null;
  column: string;
  field: string;
  value: unknown;
  message: string;
}

export interface PlayerImportValidationResult {
  valid: boolean;
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  status: "completed" | "failed";
  logId?: string;
  errors: PlayerImportError[];
}

export interface PlayerImportResult {
  valid: true;
  logId: string;
  totalRows: number;
  importedRows: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  status: "completed";
  errors: PlayerImportError[];
}

export type PlayerExportMode = "full" | "sample" | "empty";

export interface PlayerExportRequest {
  mode: PlayerExportMode;
  confirmation?: string;
}
