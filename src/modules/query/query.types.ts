export interface QueryRequest {
  query: string;
  limit?: number;
}

export interface QueryResponse {
  query: string;
  results: {
    content: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata: any;
    score?: number;
  }[];
  count: number;
  timestamp: string;
}
