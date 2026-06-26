import { describe, it, expect } from "vitest";
import { HNStorySchema, transformHNStory } from "../../src/transformer/hnTransformer";

describe("hnTransformer", () => {
  const validStory = {
    hn_item_id: 12345678,
    title: "Show HN: My project",
    url: "https://example.com",
    score: 42,
    author: "pg",
    comment_count: 10,
    story_type: "show" as const,
  };

  it("parses valid story data", () => {
    const result = transformHNStory(validStory);
    expect(result).toEqual(validStory);
  });

  it("accepts null url", () => {
    const result = transformHNStory({ ...validStory, url: null });
    expect(result.url).toBeNull();
  });

  it("accepts all story_type enum values", () => {
    for (const story_type of ["story", "ask", "show", "job"] as const) {
      const result = transformHNStory({ ...validStory, story_type });
      expect(result.story_type).toBe(story_type);
    }
  });

  it("rejects invalid story_type", () => {
    expect(() =>
      transformHNStory({ ...validStory, story_type: "poll" })
    ).toThrow();
    expect(() =>
      HNStorySchema.parse({ ...validStory, story_type: "poll" })
    ).toThrow();
  });

  it("rejects missing hn_item_id", () => {
    const { hn_item_id: _, ...invalid } = validStory;
    expect(() => transformHNStory(invalid)).toThrow();
  });

  it("rejects non-numeric score", () => {
    expect(() => transformHNStory({ ...validStory, score: "42" })).toThrow();
  });
});
