import { v4 as uuidv4 } from "uuid";

export type JobSource = "books" | "hackernews";

export interface JobDescriptor {
  jobId: string;
  source: JobSource;
  createdAt: string;
  payload: Record<string, unknown>;
  attempt: number;
}

export function createJobDescriptor(source: JobSource): JobDescriptor {
  return {
    jobId: uuidv4(),
    source,
    createdAt: new Date().toISOString(),
    payload: {},
    attempt: 1,
  };
}