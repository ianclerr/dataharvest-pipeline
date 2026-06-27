import db from "../db/client";
import { Book } from "../transformer/bookTransformer";
import { HNStory } from "../transformer/hnTransformer";
import logger from "../logger";
import { sseEmitter } from "../events/sseEmitter";

export async function upsertBooks(books: Book[]) {
  if (books.length === 0) return;

  // Batch INSERT en lugar de N queries individuales
  await db("books")
    .insert(
      books.map((book) => ({
        upc: book.upc,
        title: book.title,
        price_gbp: book.price_gbp,
        rating: book.rating,
        category: book.category,
        available: book.available,
        description: book.description,
        num_reviews: book.numReviews,
        product_url: book.product_url,
        scraped_at: new Date(),
      }))
    )
    .onConflict("upc")
    .merge();
    for (const book of books) sseEmitter.emitBook(book);

  logger.info({ module: "upsert" }, `Upserted ${books.length} books`);
}

export async function upsertStories(stories: HNStory[]) {
  if (stories.length === 0) return;

  // Batch INSERT en lugar de N queries individuales
  await db("hn_stories")
    .insert(
      stories.map((story) => ({
        hn_item_id: story.hn_item_id,
        title: story.title,
        url: story.url,
        score: story.score,
        author: story.author,
        comment_count: story.comment_count,
        story_type: story.story_type,
        scraped_at: new Date(),
      }))
    )
    .onConflict("hn_item_id")
    .merge();
    for (const story of stories) sseEmitter.emitStory(story);

  logger.info({ module: "upsert" }, `Upserted ${stories.length} stories`);
}
