import { describe, it, expect } from "vitest";
import { transformBook } from "../../src/transformer/bookTransformer";
import { transformHNStory } from "../../src/transformer/hnTransformer";

describe("scraper → transformer pipeline contract", () => {
  it("transforms raw books scraper output into validated books", () => {
    const scraperOutput = {
      title: "Tipping the Velvet",
      price_gbp: 53.74,
      rating: 1,
      available: true,
      product_url: "https://books.toscrape.com/catalogue/tipping-the-velvet_999/index.html",
      upc: "0312265821",
      description: "Through the looking glass.",
      numReviews: 0,
      category: "Historical Fiction",
    };

    const book = transformBook(scraperOutput);
    expect(book.title).toBe(scraperOutput.title);
    expect(book.upc).toBe(scraperOutput.upc);
    expect(book.rating).toBe(1);
  });

  it("transforms raw HN scraper output into validated stories", () => {
    const scraperOutput = {
      hn_item_id: 87654321,
      title: "Ask HN: Best practices?",
      url: null,
      score: 5,
      author: "dang",
      age_text: "2 hours ago",
      comment_count: 3,
      story_type: "ask",
    };

    const story = transformHNStory(scraperOutput);
    expect(story.story_type).toBe("ask");
    expect(story.hn_item_id).toBe(87654321);
    expect(story.author).toBe("dang");
  });
});
