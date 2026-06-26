import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PostgreSqlContainer, StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import knex, { Knex } from "knex";

describe("Database integration", () => {
  let container: StartedPostgreSqlContainer;
  let db: Knex;

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16").start();

    db = knex({
      client: "pg",
      connection: container.getConnectionUri(),
    });

    await db.schema.createTable("books", (t) => {
      t.uuid("id").primary().defaultTo(db.raw("gen_random_uuid()"));
      t.string("upc", 30).unique().notNullable();
      t.text("title").notNullable();
      t.decimal("price_gbp", 8, 2);
      t.smallint("rating");
      t.string("category", 80);
      t.boolean("available");
      t.text("description").nullable();
      t.integer("num_reviews");
      t.timestamp("scraped_at", { useTz: true }).defaultTo(db.fn.now());
    });

    await db.schema.createTable("hn_stories", (t) => {
      t.uuid("id").primary().defaultTo(db.raw("gen_random_uuid()"));
      t.bigInteger("hn_item_id").unique().notNullable();
      t.text("title").notNullable();
      t.text("url").nullable();
      t.integer("score");
      t.string("author", 100);
      t.integer("comment_count");
      t.string("story_type", 20);
      t.timestamp("scraped_at", { useTz: true }).defaultTo(db.fn.now());
    });
  }, 60000);

  afterAll(async () => {
    await db.destroy();
    await container.stop();
  });

  it("upserts a book without duplicating", async () => {
    const book = {
      upc: "abc123",
      title: "Test Book",
      price_gbp: 9.99,
      rating: 4,
      category: "Fiction",
      available: true,
      description: "A test book",
      num_reviews: 10,
    };

    await db("books").insert(book).onConflict("upc").merge();
    await db("books").insert(book).onConflict("upc").merge();

    const books = await db("books").where("upc", "abc123");
    expect(books).toHaveLength(1);
    expect(books[0].title).toBe("Test Book");
  });

  it("upserts an HN story without duplicating", async () => {
    const story = {
      hn_item_id: 99999999,
      title: "Test Story",
      url: "https://example.com",
      score: 42,
      author: "testuser",
      comment_count: 5,
      story_type: "story",
    };

    await db("hn_stories").insert(story).onConflict("hn_item_id").merge();
    await db("hn_stories").insert(story).onConflict("hn_item_id").merge();

    const stories = await db("hn_stories").where("hn_item_id", 99999999);
    expect(stories).toHaveLength(1);
    expect(stories[0].title).toBe("Test Story");
  });
});