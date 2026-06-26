import { z } from "zod";
import { v4 as uuidv4 } from "uuid";

export const JobSourceSchema = z.enum(["books", "hackernews"]);
export type JobSource = z.infer<typeof JobSourceSchema>;

export const JobDescriptorSchema = z.object({
  jobId: z.uuid(),
  source: JobSourceSchema,
  createdAt: z.string(),
  payload: z.union([z.record(z.string(), z.unknown()), z.array(z.unknown())]),
  attempt: z.number().int().positive(),
});

export type JobDescriptor = z.infer<typeof JobDescriptorSchema>;

export function parseJobDescriptor(data: unknown): JobDescriptor {
  return JobDescriptorSchema.parse(data);
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
