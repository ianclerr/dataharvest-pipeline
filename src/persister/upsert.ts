import db from "../db/client";
import { Book } from "../transformer/bookTransformer";
import { HNStory } from "../transformer/hnTransformer";
import logger from "../logger";

export async function upsertBooks(books: Book[]) {
  for (const book of books) {
    await db("books")
      .insert({
        upc: book.upc,
        title: book.title,
        price_gbp: book.price_gbp,
        rating: book.rating,
        category: book.category,
        available: book.available,
        description: book.description,
        num_reviews: book.numReviews,
        scraped_at: new Date(),
      })
      .onConflict("upc")
      .merge();
  }
  logger.info({ module: "upsert" }, `Upserted ${books.length} books`);
}

export async function upsertStories(stories: HNStory[]) {
  for (const story of stories) {
    await db("hn_stories")
      .insert({
        hn_item_id: story.hn_item_id,
        title: story.title,
        url: story.url,
        score: story.score,
        author: story.author,
        comment_count: story.comment_count,
        story_type: story.story_type,
        scraped_at: new Date(),
      })
      .onConflict("hn_item_id")
      .merge();
  }
  logger.info({ module: "upsert" }, `Upserted ${stories.length} stories`);
}