import { z } from "zod";

export const HNStorySchema = z.object({
  hn_item_id: z.number(),
  title: z.string(),
  url: z.string().nullable(),
  score: z.number(),
  author: z.string(),
  comment_count: z.number(),
  story_type: z.enum(["story", "ask", "show", "job"]),
});


export type HNStory = z.infer<typeof HNStorySchema>;

export function transformHNStory(raw: unknown): HNStory {
  try {
    return HNStorySchema.parse(raw);
  } catch (err) {
    console.error("ZOD ERROR:", JSON.stringify(raw, null, 2));
    throw err;
  }
}