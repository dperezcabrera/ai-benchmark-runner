
export interface BenchmarkFile {
  name: string;
  content: string;
  readOnly?: boolean;
}

export type LevelFile = BenchmarkFile;

export interface Level {
  id: string;
  title: string;
  description: string;
  files: LevelFile[];
  hints?: string[];
  solution?: { [key: string]: string };
}

export interface ModelProposal {
  id: string;
  modelName: string;
  algorithmName: string; // Descriptive name (e.g. "Greedy v1")
  code: string;          // The python code implementing calculate_batches
  active: boolean;
}

export interface RunResultDetail {
  name: string;      
  model: string;     
  algorithm: string; 
  version: string;
  batches: number;
  time: number;
  verified: boolean;
  score: number;
  completedWaves: number; // Number of waves successfully passed
  lastVerifiedWave?: number; // Track which wave index was last verified to avoid double counting
  error?: string;
}

export interface BenchmarkResult {
  status: 'IDLE' | 'RUNNING' | 'SUCCESS' | 'FAILURE' | 'TIMEOUT';
  executionTime: number; // Total run time
  verified: boolean;
  score?: number; // Total aggregate score
  message?: string;
  ranking?: RunResultDetail[]; // Detailed results for ranking
}

export interface BenchmarkConfig {
  timeoutSeconds: number;
}
