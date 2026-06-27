export const swaggerSpec = {
  openapi: "3.1.0",
  info: {
    title: "DataHarvest Pipeline API",
    version: "1.0.0",
    description: "REST API for the DataHarvest scraping pipeline",
  },
  paths: {
    "/api/v1/jobs/trigger": {
      post: {
        summary: "Manually trigger a scrape job",
        tags: ["Jobs"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  source: { type: "string", enum: ["books", "hackernews"] },
                },
                required: ["source"],
              },
            },
          },
        },
        responses: {
          201: { description: "Job created" },
          400: { description: "Invalid source" },
        },
      },
    },
    "/api/v1/jobs": {
      get: {
        summary: "List all scrape jobs",
        tags: ["Jobs"],
        parameters: [
          { name: "status", in: "query", schema: { type: "string", enum: ["pending", "processing", "done", "failed"] } },
          { name: "source", in: "query", schema: { type: "string", enum: ["books", "hackernews"] } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
        ],
        responses: { 200: { description: "List of jobs" } },
      },
    },
    "/api/v1/jobs/{id}": {
      get: {
        summary: "Get a single job by ID",
        tags: ["Jobs"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          200: { description: "Job detail" },
          404: { description: "Job not found" },
        },
      },
    },
    "/api/v1/jobs/dlq": {
      get: {
        summary: "Inspect dead-letter queue (last 50)",
        tags: ["DLQ"],
        responses: { 200: { description: "DLQ entries" } },
      },
    },
    "/api/v1/jobs/dlq/{jobId}": {
      delete: {
        summary: "Remove a job from the DLQ",
        tags: ["DLQ"],
        parameters: [{ name: "jobId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: { description: "Job removed" },
          404: { description: "Job not found" },
        },
      },
    },
    "/api/v1/jobs/dlq/{jobId}/retry": {
      post: {
        summary: "Re-queue a DLQ job for reprocessing",
        tags: ["DLQ"],
        parameters: [{ name: "jobId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: { description: "Job re-queued" },
          404: { description: "Job not found" },
        },
      },
    },
    "/api/v1/books": {
      get: {
        summary: "List scraped books",
        tags: ["Books"],
        parameters: [
          { name: "category", in: "query", schema: { type: "string" } },
          { name: "minRating", in: "query", schema: { type: "integer", minimum: 1, maximum: 5 } },
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
        ],
        responses: { 200: { description: "List of books" } },
      },
    },
    "/api/v1/books/{upc}": {
      get: {
        summary: "Get a single book by UPC",
        tags: ["Books"],
        parameters: [{ name: "upc", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: { description: "Book detail" },
          404: { description: "Book not found" },
        },
      },
    },
    "/api/v1/stories": {
      get: {
        summary: "List HN stories",
        tags: ["Stories"],
        parameters: [
          { name: "type", in: "query", schema: { type: "string", enum: ["story", "ask", "show", "job"] } },
          { name: "minScore", in: "query", schema: { type: "integer" } },
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
        ],
        responses: { 200: { description: "List of stories" } },
      },
    },
    "/api/v1/stories/{hn_item_id}": {
      get: {
        summary: "Get a single story by HN item ID",
        tags: ["Stories"],
        parameters: [{ name: "hn_item_id", in: "path", required: true, schema: { type: "integer" } }],
        responses: {
          200: { description: "Story detail" },
          404: { description: "Story not found" },
        },
      },
    },
    "/api/v1/metrics": {
      get: {
        summary: "Queue metrics (depth, throughput, error rate)",
        tags: ["Observability"],
        responses: { 200: { description: "Metrics per queue" } },
      },
    },
    "/api/v1/health": {
      get: {
        summary: "Health check (DB + Redis)",
        tags: ["Observability"],
        responses: {
          200: { description: "All systems healthy" },
          503: { description: "One or more systems down" },
        },
      },
    },
  },
};