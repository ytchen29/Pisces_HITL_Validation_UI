
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

export interface ReviewerComment {
  reviewer: string;
  text: string;
  timestamp?: string;
}

export interface SFFField<T = any> {
  id: string;
  path: string; // Absolute path in the JSON, e.g., "units[0].design_input_specs.temperature"
  key: string; // Hierarchical key for display, e.g., "design_input_specs.temperature"
  label: string; // Human readable label (usually last part of key)
  value: T; // The currently selected value
  confidence: ConfidenceLevel;
  confidenceDescription?: string; // Detailed reason for the confidence level
  alternatives: AgentContribution[]; // If conflict exists
  isResolved: boolean; // Has the human approved this?
  reviewedBy: string[]; // List of Reviewer IDs who verified this field
  section: string; // e.g., "Metadata", "Unit: P-13/V-102"
  source?: SourceReference; // Source for the CURRENT value (important for Medium confidence)
  comments: ReviewerComment[]; // History of reviewer comments
}

export interface SFFData {
  fileName: string;
  reviewerId: string;
  fields: SFFField[];
  originalJson: any; // Store original JSON for faithful export
}

export interface SelectionContext {
  fieldId: string | null;
  snippet: string;
  value: any; // Added value to help targeted highlighting
  page: number;
  agent: string;
  location?: string;
  type?: string;
}
