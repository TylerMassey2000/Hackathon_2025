import puppeteer from "puppeteer";
import { scanEula } from "./functions/scanEula.js";

export async function fetchAndScanEula(companyName, eulaUrl) {
  const start = Date.now();
  console.log(`\n🕐 [${new Date().toLocaleTimeString()}] START fetch for ${companyName}`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    console.log("➡️  Navigating...");
    await page.goto(eulaUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
    console.log(`✅  Page reached in ${(Date.now() - start) / 1000}s`);

    console.log("➡️  Extracting text...");
    const text = await page.evaluate(() => document.body.innerText || "");
    console.log(`✅  Extracted ${text.length} characters`);

    await browser.close();

    if (text.length < 200) {
      console.warn("⚠️  Little or no text found; skipping AI call");
      return;
    }

    console.log("➡️  Sending to AI...");
    await scanEula(companyName, text.slice(0, 10000));
    console.log(`🏁  Finished in ${(Date.now() - start) / 1000}s`);
  } catch (err) {
    console.error(`❌  Error during fetch: ${err.message}`);
    await browser.close();
  }
}
