import { Router } from "express";
import db from "../../db/client";

const router = Router();

// GET /api/v1/books
router.get("/", async (req, res) => {
  try {
    const { category, minRating, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const query = db("books").orderBy("scraped_at", "desc")
      .limit(Number(limit)).offset(offset);

    if (category) query.where("category", category);
    if (minRating) query.where("rating", ">=", Number(minRating));

    const books = await query;
    return res.json(books);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
});

// GET /api/v1/books/:upc
router.get("/:upc", async (req, res) => {
  try {
    const book = await db("books").where("upc", req.params.upc).first();
    if (!book) return res.status(404).json({ error: "Book not found" });
    return res.json(book);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
});

export default router;