import { chromium } from "playwright";
import logger from "../../logger";

const USER_AGENT = "DataHarvestBot/1.0 (tech-assessment)";
const BASE_URL = "https://books.toscrape.com";
const RATING_MAP: Record<string, number> = {
  One: 1, Two: 2, Three: 3, Four: 4, Five: 5,
};

export async function scrapeBooksFallback() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: USER_AGENT });
  const page = await context.newPage();
  const books = [];

  try {
    for (let pageNum = 1; pageNum <= 5; pageNum++) {
      const url = `${BASE_URL}/catalogue/page-${pageNum}.html`;
      logger.info({ module: "booksScraperPlaywright", pageNum }, "Scraping page (headless)");

      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15_000 });

      // Esperar a que los artículos estén presentes
      await page.waitForSelector("article.product_pod", { timeout: 10_000 });

      const items = await page.$$eval("article.product_pod", (els) =>
        els.map((el) => ({
          title: el.querySelector("h3 a")?.getAttribute("title") ?? "",
          href: el.querySelector("h3 a")?.getAttribute("href") ?? "",
          price: el.querySelector(".price_color")?.textContent?.replace("£", "").trim() ?? "0",
          ratingClass: el.querySelector(".star-rating")?.className ?? "",
          available: el.querySelector(".availability")?.textContent?.trim() === "In stock",
        }))
      );

      for (const item of items) {
        const relativeUrl = item.href.replace("../", "");
        const productUrl = `${BASE_URL}/catalogue/${relativeUrl}`;
        const ratingWord = item.ratingClass.replace("star-rating ", "").trim();

        // Throttle cortés entre páginas de detalle
        await page.waitForTimeout(1000);
        await page.goto(productUrl, { waitUntil: "domcontentloaded", timeout: 15_000 });

        const detail = await page.evaluate(() => {
          const rows = Array.from(document.querySelectorAll("table tr"));
          const getCell = (label: string) =>
            rows.find((r) => r.querySelector("th")?.textContent === label)
              ?.querySelector("td")?.textContent ?? "";

          return {
            upc: getCell("UPC"),
            description:
              document.querySelector("#product_description ~ p")?.textContent?.trim() ?? null,
            numReviews: parseInt(getCell("Number of reviews") || "0"),
            category:
              document.querySelectorAll("ul.breadcrumb li")[2]
                ?.querySelector("a")?.textContent?.trim() ?? null,
          };
        });

        if (!detail.upc) continue;

        books.push({
          title: item.title,
          price_gbp: parseFloat(item.price),
          rating: RATING_MAP[ratingWord] || 0,
          available: item.available,
          product_url: productUrl,
          ...detail,
        });

        await page.goBack();
      }
    }
  } finally {
    await browser.close();
  }

  return books;
}