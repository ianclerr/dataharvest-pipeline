import { describe, it, expect } from "vitest";
import { BookSchema, transformBook } from "../../src/transformer/bookTransformer";

describe("bookTransformer", () => {
  const validBook = {
    title: "A Light in the Attic",
    price_gbp: 51.77,
    rating: 3,
    available: true,
    upc: "a897fe39b1053632",
    description: "It's hard to imagine a world without A Light in the Attic.",
    numReviews: 22,
    category: "Poetry",
  };

  it("parses valid book data", () => {
    const result = transformBook(validBook);
    expect(result).toEqual(validBook);
  });

  it("accepts null description and category", () => {
    const result = transformBook({ ...validBook, description: null, category: null });
    expect(result.description).toBeNull();
    expect(result.category).toBeNull();
  });

  it("rejects missing title", () => {
    const { title: _, ...invalid } = validBook;
    expect(() => transformBook(invalid)).toThrow();
    expect(() => BookSchema.parse(invalid)).toThrow();
  });

  it("rejects rating below 1", () => {
    expect(() => transformBook({ ...validBook, rating: 0 })).toThrow();
  });

  it("rejects rating above 5", () => {
    expect(() => transformBook({ ...validBook, rating: 6 })).toThrow();
  });

  it("rejects non-numeric price_gbp", () => {
    expect(() => transformBook({ ...validBook, price_gbp: "51.77" })).toThrow();
  });

  it("rejects non-boolean available", () => {
    expect(() => transformBook({ ...validBook, available: "yes" })).toThrow();
  });
});
