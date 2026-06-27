import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("scrape_jobs", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    t.string("source", 50).notNullable();
    t.string("status", 20).notNullable().defaultTo("pending");
    t.timestamp("triggered_at", { useTz: true }).defaultTo(knex.fn.now());
    t.timestamp("completed_at", { useTz: true }).nullable();
    t.text("error_message").nullable();
  });

  await knex.schema.createTable("books", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    t.string("upc", 30).unique().notNullable();
    t.text("title").notNullable();
    t.decimal("price_gbp", 8, 2);
    t.smallint("rating");
    t.string("category", 80);
    t.boolean("available");
    t.text("description").nullable();
    t.integer("num_reviews");
    t.text("product_url").nullable();
    t.timestamp("scraped_at", { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.createTable("hn_stories", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    t.bigInteger("hn_item_id").unique().notNullable();
    t.text("title").notNullable();
    t.text("url").nullable();
    t.integer("score");
    t.string("author", 100);
    t.integer("comment_count");
    t.string("story_type", 20);
    t.timestamp("scraped_at", { useTz: true }).defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("hn_stories");
  await knex.schema.dropTableIfExists("books");
  await knex.schema.dropTableIfExists("scrape_jobs");
}