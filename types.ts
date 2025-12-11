export type ConfidenceLevel = 'High' | 'Medium' | 'Low';

export interface SourceReference {
  page: number;
  paragraph?: string; // e.g. "Page 4, Fermentation section"
  location?: string; // Full raw location string
  type?: string; // e.g. "text", "figure", "table"
  snippet: string;
}

export interface AgentContribution {
  agentName: string; // e.g., "E1", "E2"
  value: any;
  source: SourceReference;
}

export interface SFFField<T = any> {
  id: string;
  path: string; // Absolute path in the JSON, e.g., "units[0].design_input_specs.temperature"
  key: string; // Hierarchical key for display, e.g., "design_input_specs.temperature"
  label: string; // Human readable label (usually last part of key)
  value: T; // The currently selected value
  confidence: ConfidenceLevel;
  alternatives: AgentContribution[]; // If conflict exists
  isResolved: boolean; // Has the human approved this?
  section: string; // e.g., "Metadata", "Unit: P-13/V-102"
  source?: SourceReference; // Source for the CURRENT value (important for Medium confidence)
}

export interface SFFData {
  fileName: string;
  fields: SFFField[];
  originalJson: any; // Store original JSON for faithful export
}

export interface SelectionContext {
  fieldId: string | null;
  snippet: string;
  page: number;
  agent: string;
  location?: string;
  type?: string;
}
