import { Router } from "express";
import db from "../../db/client";

const router = Router();

// GET /api/v1/books
router.get("/", async (req, res) => {
  try {
    // Sanitizamos page y limit para evitar queries masivas con valores arbitrarios
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const { category, minRating } = req.query;

    const query = db("books").orderBy("scraped_at", "desc")
      .limit(limit).offset(offset);

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