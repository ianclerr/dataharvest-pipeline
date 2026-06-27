import axios from "axios";
import * as cheerio from "cheerio";
import robotsParser from "robots-parser";
import { RateLimiter } from "../rateLimiter";
import logger from "../../logger";
import { scrapeBooksFallback } from "./booksScraperPlaywright";

const BASE_URL = "https://books.toscrape.com";
const HOST = "books.toscrape.com";
const USER_AGENT = "DataHarvestBot/1.0 (tech-assessment)";
const rateLimiter = new RateLimiter(1, Number(process.env.RATE_LIMIT_DELAY_MS) || 1000);

const RATING_MAP: Record<string, number> = {
  One: 1, Two: 2, Three: 3, Four: 4, Five: 5,
};

let robotsRules: ReturnType<typeof robotsParser> | null = null;

async function getRobotsRules() {
  if (robotsRules) return robotsRules;
  const robotsUrl = `${BASE_URL}/robots.txt`;
  try {
    const { data } = await axios.get(robotsUrl, {
      headers: { "User-Agent": USER_AGENT },
      timeout: 5000,
    });
    robotsRules = robotsParser(robotsUrl, data);
  } catch {
    robotsRules = robotsParser(robotsUrl, "");
  }
  return robotsRules;
}

function isCaptchaOrBlocked($: cheerio.CheerioAPI): boolean {
  const hasProducts = $("article.product_pod").length > 0;
  const bodyText = $("body").text().toLowerCase();
  const looksLikeCaptcha =
    bodyText.includes("captcha") ||
    bodyText.includes("access denied") ||
    bodyText.includes("verify you are human");
  return !hasProducts || looksLikeCaptcha;
}

async function fetchPage(url: string) {
  const rules = await getRobotsRules();
  if (!rules.isAllowed(url, USER_AGENT)) {
    throw new Error(`Blocked by robots.txt: ${url}`);
  }
  await rateLimiter.throttle(HOST);
  const { data } = await axios.get(url, {
    headers: { "User-Agent": USER_AGENT },
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

  const rawCategory = $("ul.breadcrumb li").eq(2).find("a").text().trim();
  const category =
    rawCategory &&
    rawCategory.length < 50 &&
    !rawCategory.toLowerCase().includes("comment")
      ? rawCategory
      : null;

  return { upc, description, numReviews, category };
}

export async function scrapeBooks() {
  let probeResult: cheerio.CheerioAPI | null = null;

  try {
    const probeUrl = `${BASE_URL}/catalogue/page-1.html`;
    const $probe = await fetchPage(probeUrl);

    if (isCaptchaOrBlocked($probe)) {
      logger.warn({ module: "booksScraper" }, "CAPTCHA detectado — activando Playwright");
      return scrapeBooksFallback();
    }

    probeResult = $probe;
  } catch (err) {
    logger.warn(
      { module: "booksScraper", err: (err as Error).message },
      "Probe falló — activando Playwright"
    );
    return scrapeBooksFallback();
  }

  const books = [];

  for (let page = 1; page <= 5; page++) {
    const url = `${BASE_URL}/catalogue/page-${page}.html`;

    logger.info({ module: "booksScraper", page }, "Scraping page");

    const $ = page === 1 && probeResult !== null ? probeResult : await fetchPage(url);
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

      let detail = { upc: "", description: null as string | null, numReviews: 0, category: null as string | null };
      try {
        detail = await scrapeBookDetail(productUrl);
      } catch (err) {
        logger.warn(
          { module: "booksScraper", productUrl, err: (err as Error).message },
          "Failed to fetch book detail, using defaults"
        );
      }
      if (!detail.upc) {
        logger.warn({ module: "booksScraper", title }, "Skipping book with empty UPC");
        continue;
      }

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