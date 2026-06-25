import axios from "axios";
import * as cheerio from "cheerio";
import { RateLimiter } from "../rateLimiter";
import logger from "../../logger";

const BASE_URL = "https://books.toscrape.com";
const HOST = "books.toscrape.com";
const rateLimiter = new RateLimiter();

const RATING_MAP: Record<string, number> = {
  One: 1, Two: 2, Three: 3, Four: 4, Five: 5,
};

async function fetchPage(url: string) {
  await rateLimiter.throttle(HOST);
  const { data } = await axios.get(url, {
    headers: { "User-Agent": "DataHarvestBot/1.0 (tech-assessment)" },
    timeout: Number(process.env.REQUEST_TIMEOUT_MS) || 10000,
  });
  return cheerio.load(data);
}

async function scrapeBookDetail(url: string) {
  const $ = await fetchPage(url);

  const upc = $("table tr").filter((_, el) =>
    $(el).find("th").text() === "UPC"
  ).find("td").text();

  const description = $("#product_description ~ p").text().trim() || null;

  const numReviews = parseInt(
    $("table tr").filter((_, el) =>
      $(el).find("th").text() === "Number of reviews"
    ).find("td").text() || "0"
  );

  const category = $("ul.breadcrumb li").eq(2).find("a").text().trim() || null;

  return { upc, description, numReviews, category };
}

export async function scrapeBooks() {
  const books = [];

  for (let page = 1; page <= 5; page++) {
    const url = `${BASE_URL}/catalogue/page-${page}.html`;

    logger.info({ module: "booksScraper", page }, "Scraping page");
    const $ = await fetchPage(url);

    const items = $("article.product_pod").toArray();

    for (const el of items) {
      const titleEl = $(el).find("h3 a");
      const title = titleEl.attr("title") || "";
      const relativeUrl = titleEl.attr("href")?.replace("../", "") || "";
      const productUrl = `${BASE_URL}/catalogue/${relativeUrl}`;
      const priceText = $(el).find(".price_color").text().replace("£", "").trim();
      const price = parseFloat(priceText);
      const ratingClass = $(el).find(".star-rating").attr("class") || "";
      const ratingWord = ratingClass.replace("star-rating ", "").trim();
      const rating = RATING_MAP[ratingWord] || 0;
      const availability = $(el).find(".availability").text().trim() === "In stock";

      const detail = await scrapeBookDetail(productUrl);

      books.push({
        title,
        price_gbp: price,
        rating,
        available: availability,
        product_url: productUrl,
        ...detail,
      });
    }
  }

  return books;
}