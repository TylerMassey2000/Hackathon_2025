// background.js — Deep DOM legal discovery (C3), combine → fuzzy extract → AI Top-5
import {
  COMMON_PATHS, LINK_TEXT_RE, toOrigin, absolutize, uniq,
  wordCount, categorize, sortByCategoryPriority,
  extractDataClauses, aiTop5DataViolations
} from "./shared.js";

const MAX_PAGES = 10; // cap for C3 mode

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "CRAWL_CURRENT_SITE") {
    (async () => {
      try {
        const { tabId, url } = msg;
        const origin = toOrigin(url);
        if (!origin) throw new Error("Invalid tab URL");

        await ensureOffscreen();

        // PHASE 1: brute guess (rooted)
        const guessCandidates = groupAndPick(origin, COMMON_PATHS.map(p => absolutize(origin, p)).filter(Boolean));

        // PHASE 2: deep DOM discovery (anchors + nav + menus + footer)
        const deepDomLinks = await deepDiscoverLinksOnPage(tabId, origin);

        // PHASE 2b: also parse root "/" HTML for links (some SPAs hide in home)
        const rootResp = await tryFetch(origin + "/");
        let rootLinks = [];
        if (rootResp?.html) {
          const parsed = await parseWithOffscreen(rootResp.html, origin, origin + "/", true);
          if (parsed?.ok && parsed.links?.length) rootLinks = parsed.links;
        }

        // PHASE 3: site search fallback
        const searchCandidates = await siteSearchFallback(origin);

        // Merge & prioritize
        let candidates = uniq([ ...guessCandidates, ...deepDomLinks, ...rootLinks, ...searchCandidates ]);
        candidates = sortByCategoryPriority(candidates);

        // C3 EXPANSION: for each found legal page, add sibling/child links with legal-ish tokens
        candidates = await expandLegalSiblings(candidates, origin);

        // cap to MAX_PAGES
        candidates = candidates.slice(0, MAX_PAGES);

        // Fetch & parse
        const pages = [];
        for (const candidate of candidates) {
          const res = await tryFetch(candidate);
          if (!res) continue;
          const parsed = await parseWithOffscreen(res.html, origin, candidate, false);
          if (!parsed?.ok) continue;
          const wc = wordCount(parsed.text);
          if (wc < 60) continue;
          pages.push({ url: candidate, title: parsed.title, text: parsed.text, wc, cat: categorize(candidate) });
        }

        if (pages.length === 0) {
          const pageText = await getCurrentPageText(tabId);
          const clauses = pageText ? extractDataClauses(pageText) : [];
          const ai = clauses.length ? await aiTop5DataViolations({ url, clauses }) : { items: [], raw: "" };
          sendResponse({ ok: true, origin, combined: null, sections: [], top5: ai.items, raw: ai.raw });
          return;
        }

        // Combine text for AI (we only send text, not sections, to keep payload small)
        pages.sort((a,b) => {
          const pri = {terms:0, privacy:1, legal:2, policy:3, cookie:4, safety:5, security:6, guidelines:7, other:8};
          return pri[a.cat]-pri[b.cat] || b.wc - a.wc;
        });
        const combinedText = pages.map(p => `# ${p.title}\n${p.text}`).join("\n\n---\n\n");

        const clauses = extractDataClauses(combinedText);
        const ai = clauses.length ? await aiTop5DataViolations({ url: pages[0].url, clauses }) : { items: [], raw: "" };

        sendResponse({
          ok: true,
          origin,
          combined: { title: pages[0].title + " (combined)", url: pages[0].url, wc: wordCount(combinedText) },
          sections: pages.map(p => ({ url: p.url, title: p.title, wc: p.wc, cat: p.cat })),
          top5: ai.items,
          raw: ai.raw
        });
      } catch (e) {
        sendResponse({ ok: false, error: e.message || String(e) });
      }
    })();
    return true;
  }
});

/* ---------- Deep discovery helpers ---------- */

function bucketByCategory(urls){const m={};for(const u of urls){const c=categorize(u);(m[c] ||= []).push(u);}return m;}
function groupAndPick(origin, urls){const clean=uniq(urls).filter(Boolean);const buckets=bucketByCategory(clean);const picked=[];for(const list of Object.values(buckets)){const sorted=list.sort((a,b)=>scoreUrl(a)-scoreUrl(b));picked.push(...sorted.slice(0,3));}return picked;}
function scoreUrl(u){try{const x=new URL(u);const segs=x.pathname.split("/").filter(Boolean).length;const q=x.search?2:0;const f=x.hash?1:0;return segs+q+f;}catch{return 99;}}

async function ensureOffscreen() {
  if (!chrome.offscreen?.hasDocument) return;
  const has = await chrome.offscreen.hasDocument();
  if (!has) {
    await chrome.offscreen.createDocument({
      url: chrome.runtime.getURL("offscreen.html"),
      reasons: ["DOM_PARSER"],
      justification: "Parse fetched HTML and extract links/text in MV3"
    });
  }
}

async function parseWithOffscreen(html, origin, baseUrl, wantLinks = false) {
  return await chrome.runtime.sendMessage({ type: "OFFSCREEN_PARSE", html, origin, baseUrl, wantLinks });
}

// Deep DOM scan: anchors + nav + menus + footer, plus aria/menu roles
async function deepDiscoverLinksOnPage(tabId, origin) {
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const SEL = [
          "a[href]",
          "nav a[href]",
          "footer a[href]",
          "[role='menuitem'][href]",
          "[class*='nav'] a[href]",
          "[class*='menu'] a[href]",
          "[class*='footer'] a[href]"
        ].join(",");
        const RE = /\b(terms?|tos|privacy|policy|policies|legal|eula|cookie|cookies|data|safety|security|guidelines|community)\b/i;
        const anchors = [...document.querySelectorAll(SEL)];
        const out = [];
        for (const a of anchors) {
          const href = a.getAttribute("href") || "";
          const txt = (a.innerText || a.textContent || "").trim();
          const aria = (a.getAttribute("aria-label") || "").trim();
          if (!href) continue;
          if (!RE.test(txt + " " + aria + " " + href)) continue;
          out.push(href);
        }
        return out;
      }
    });
    const abs = [];
    for (const href of (result || [])) {
      try {
        const u = new URL(href, location.href);
        if (u.origin === origin) abs.push(u.href);
      } catch {}
    }
    return uniq(abs);
  } catch { return []; }
}

// Expand sibling/child links around identified legal pages (C3)
async function expandLegalSiblings(urls, origin) {
  const seeds = uniq(urls);
  const out = new Set(seeds);
  const TOKEN = /\b(terms?|privacy|policy|polic|cookie|cookies|legal|eula|data|safety|security|guidelines|community)\b/i;

  for (const u of seeds.slice(0, MAX_PAGES)) {
    const res = await tryFetch(u);
    if (!res?.html) continue;
    const parsed = await parseWithOffscreen(res.html, origin, u, true);
    const links = parsed?.links || [];
    for (const l of links) {
      if (!TOKEN.test(l)) continue;
      out.add(l);
      if (out.size >= MAX_PAGES) break;
    }
    if (out.size >= MAX_PAGES) break;
  }
  return Array.from(out);
}

async function siteSearchFallback(origin) {
  const candidates = [];
  const paths = [
    "/search?q=terms","/search?q=privacy","/search?q=legal","/search?q=policy",
    "/support/search?q=terms","/support/search?q=privacy","/support/search?q=legal"
  ];
  for (const p of paths) {
    const url = absolutize(origin, p);
    try {
      const resp = await fetch(url, { redirect: "follow", credentials: "omit" });
      if (!resp.ok) continue;
      const ct = resp.headers.get("content-type") || "";
      if (!/text\/html/i.test(ct)) continue;
      const html = await resp.text();
      const parsed = await parseWithOffscreen(html, origin, url, true);
      if (parsed?.ok && Array.isArray(parsed.links)) candidates.push(...parsed.links);
    } catch {}
  }
  return uniq(candidates);
}

async function tryFetch(url) {
  try {
    const resp = await fetch(url, { redirect: "follow", credentials: "omit" });
    if (!resp.ok) return null;
    const ct = resp.headers.get("content-type") || "";
    if (!/text\/html/i.test(ct)) return null;  // ignore PDFs for now
    const html = await resp.text();
    return { html };
  } catch { return null; }
}

async function getCurrentPageText(tabId) {
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => (document.body?.innerText || "").replace(/\u00a0/g, " ")
    });
    return result || "";
  } catch { return ""; }
}
