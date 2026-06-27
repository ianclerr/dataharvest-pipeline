import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { RedisContainer, StartedRedisContainer } from "@testcontainers/redis";
import knex, { Knex } from "knex";
import { Queue, Worker } from "bullmq";
import { transformBook } from "../../src/transformer/bookTransformer";
import { transformHNStory } from "../../src/transformer/hnTransformer";
import { createJobDescriptor } from "../../src/scheduler/jobFactory";

describe("pipeline integration — scrape:raw → transformer → scrape:processed", () => {
  let pgContainer: StartedPostgreSqlContainer;
  let redisContainer: StartedRedisContainer;
  let db: Knex;
  let rawQueue: Queue;
  let processedQueue: Queue;
  let connection: { host: string; port: number };

  beforeAll(async () => {
    // Levantar contenedores reales
    [pgContainer, redisContainer] = await Promise.all([
      new PostgreSqlContainer("postgres:16").start(),
      new RedisContainer("redis:7-alpine").start(),
    ]);

    db = knex({
      client: "pg",
      connection: pgContainer.getConnectionUri(),
    });

    await db.schema.createTable("books", (t) => {
      t.uuid("id").primary().defaultTo(db.raw("gen_random_uuid()"));
      t.string("upc", 30).unique().notNullable();
      t.text("title").notNullable();
      t.decimal("price_gbp", 8, 2);
      t.smallint("rating");
      t.string("category", 80).nullable();
      t.boolean("available");
      t.text("description").nullable();
      t.integer("num_reviews");
      t.timestamp("scraped_at", { useTz: true }).defaultTo(db.fn.now());
    });

    connection = {
      host: redisContainer.getHost(),
      port: redisContainer.getFirstMappedPort(),
    };

    rawQueue = new Queue("scrape-raw", { connection });
    processedQueue = new Queue("scrape-processed", { connection });
  }, 90000);

  afterAll(async () => {
    await rawQueue.close();
    await processedQueue.close();
    await db.destroy();
    await pgContainer.stop();
    await redisContainer.stop();
  });

  it("transformer worker consumes raw job and pushes to processed queue", async () => {
    const descriptor = createJobDescriptor("books");
    const rawPayload = [
      {
        title: "Test Book",
        price_gbp: 9.99,
        rating: 3,
        available: true,
        upc: "test-upc-001",
        description: "A test book",
        numReviews: 5,
        category: "Fiction",
      },
    ];

    // Agregar job a scrape:raw
    await rawQueue.add("raw-data", { ...descriptor, payload: rawPayload });

    // Worker que simula transformerWorker
    const processed: unknown[] = [];
    const worker = new Worker(
      "scrape-raw",
      async (job) => {
        const { payload, source } = job.data;
        if (!Array.isArray(payload)) throw new Error("Payload must be array");
        const items =
          source === "books"
            ? payload.map(transformBook)
            : payload.map(transformHNStory);
        await processedQueue.add("processed-data", {
          ...job.data,
          payload: items,
        });
        processed.push(...items);
      },
      { connection, concurrency: 1 }
    );

    // Esperar a que el worker procese el job
    await new Promise<void>((resolve, reject) => {
      worker.on("completed", () => resolve());
      worker.on("failed", (_, err) => reject(err));
      setTimeout(() => reject(new Error("Timeout")), 10000);
    });

    await worker.close();

    expect(processed).toHaveLength(1);
    expect((processed[0] as any).upc).toBe("test-upc-001");
    expect((processed[0] as any).rating).toBe(3);

    // Verificar que el job llegó a scrape:processed
    const processedJobs = await processedQueue.getJobs(["waiting"]);
    expect(processedJobs).toHaveLength(1);
    expect(processedJobs[0].data.payload[0].upc).toBe("test-upc-001");
  });

  it("upsert persister no duplica registros en DB real", async () => {
    const book = {
      upc: "persist-test-001",
      title: "Persistence Test Book",
      price_gbp: 15.99,
      rating: 4,
      category: "Science",
      available: true,
      description: null,
      num_reviews: 0,
    };

    // Insertar dos veces — debe quedar solo un registro
    await db("books").insert(book).onConflict("upc").merge();
    await db("books")
      .insert({ ...book, title: "Updated Title" })
      .onConflict("upc")
      .merge();

    const rows = await db("books").where("upc", "persist-test-001");
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("Updated Title"); // merge actualiza
  });
}, 90000);