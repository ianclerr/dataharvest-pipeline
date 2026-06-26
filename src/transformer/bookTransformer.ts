import { z } from "zod";

export const BookSchema = z.object({
  title: z.string(),
  price_gbp: z.number(),
  rating: z.number().min(0).max(5).transform((r) => Math.max(1, r)),
  available: z.boolean(),
  upc: z.string(),
  description: z.string().nullable(),
  numReviews: z.number(),
  category: z.string().nullable(),
});

export type Book = z.infer<typeof BookSchema>;

export function transformBook(raw: unknown): Book {
  return BookSchema.parse(raw);
}