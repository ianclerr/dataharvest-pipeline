import { describe, it, expect } from "vitest";
import {
  JobDescriptorSchema,
  createJobDescriptor,
  parseJobDescriptor,
} from "../../src/scheduler/jobFactory";

describe("jobFactory", () => {
  it("creates a valid job descriptor", () => {
    const job = createJobDescriptor("books");
    expect(() => parseJobDescriptor(job)).not.toThrow();
    expect(job.source).toBe("books");
    expect(job.attempt).toBe(1);
    expect(job.payload).toEqual({});
  });

  it("accepts array payloads after scraping", () => {
    const job = {
      ...createJobDescriptor("hackernews"),
      payload: [{ hn_item_id: 1, title: "Test" }],
    };
    expect(() => parseJobDescriptor(job)).not.toThrow();
  });

  it("rejects invalid source", () => {
    const job = { ...createJobDescriptor("books"), source: "twitter" };
    expect(() => parseJobDescriptor(job)).toThrow();
    expect(() => JobDescriptorSchema.parse(job)).toThrow();
  });

  it("rejects invalid jobId", () => {
    const job = { ...createJobDescriptor("books"), jobId: "not-a-uuid" };
    expect(() => parseJobDescriptor(job)).toThrow();
  });

  it("rejects non-positive attempt", () => {
    const job = { ...createJobDescriptor("books"), attempt: 0 };
    expect(() => parseJobDescriptor(job)).toThrow();
  });
});
