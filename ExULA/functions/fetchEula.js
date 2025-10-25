// fetchEula.js
import puppeteer from "puppeteer";
import { scanEula } from "./scanEula.js";

export async function fetchAndScanEula(companyName, eulaUrl) {
  console.log(`\n🌐 Launching browser to fetch: ${eulaUrl}`);
  const start = Date.now();

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage"
    ]
  });

  try {
    const page = await browser.newPage();

    // Block heavy resources for speed
    await page.setRequestInterception(true);
    page.on("request", req => {
      const type = req.resourceType();
      if (["image", "stylesheet", "font", "media"].includes(type)) req.abort();
      else req.continue();
    });

    // Make Puppeteer act like a normal browser
    await page.setViewport({ width: 1366, height: 768 });
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9"
    });

    console.log("➡️ Navigating...");
    await page.goto(eulaUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
    console.log(`✅ Page reached in ${(Date.now() - start) / 1000}s`);

    // Optional: click consent/cookie banners
    const consentSelectors = [
      'button#onetrust-accept-btn-handler',
      'button[aria-label="accept cookies"]',
      "button.cookie-accept",
      'button:has-text("Accept")'
    ];

    for (const sel of consentSelectors) {
      try {
        const el = await page.$(sel);
        if (el) {
          await el.click();
          console.log(`🟢 Clicked consent button (${sel})`);
          await page.waitForTimeout(800);
          break;
        }
      } catch (_) {}
    }

    // ---- Safe-mode text extraction ----
    console.log("➡️ Extracting text (safe mode)...");
    let text = "";
    try {
      text = await Promise.race([
        page.evaluate(() => {
          const body = document.querySelector("body");
          if (!body) return "";
          const tags = ["script", "style", "noscript", "iframe", "svg"];
          tags.forEach(tag =>
            document.querySelectorAll(tag).forEach(el => el.remove())
          );
          return body.innerText || "";
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Eval timeout")), 8000)
        )
      ]);
    } catch (err) {
      console.warn(`⚠️ Text extraction failed: ${err.message}`);
    }

    const cleaned = text.replace(/\s+/g, " ").trim();
    console.log(`✅ Extracted ${cleaned.length} characters of text`);

    if (cleaned.length < 200) {
      console.warn(
        "⚠️ Page produced little or no text; skipping AI analysis (may be login-protected)."
      );
    } else {
      console.log("➡️ Sending to AI...");
      await scanEula(companyName, cleaned.slice(0, 10000));
    }
  } catch (err) {
    console.error(`❌ Error fetching EULA for ${companyName}:`, err.message);
  } finally {
    await browser.close();
    console.log(`🏁 Total runtime: ${(Date.now() - start) / 1000}s`);
  }
}
