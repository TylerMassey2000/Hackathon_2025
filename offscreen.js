// offscreen.js — DOM work happens here

function cleanTextFromHTML(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const kill = ["script","style","noscript","template","svg","canvas","header","nav","footer","aside"];
  doc.querySelectorAll(kill.join(",")).forEach(n => n.remove());
  const main = doc.querySelector("main, article, .content, #content, .legal, .tos, .privacy, .policy");
  const root = main || doc.body;
  let text = (root?.innerText || doc.body?.innerText || "").replace(/\u00a0/g, " ");
  text = text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return text;
}

function extractTitle(html, baseUrl) {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (m) return m[1].trim();
  try { return new URL(baseUrl).pathname; } catch { return "Document"; }
}

function absolutize(origin, href) {
  try { const u = new URL(href, origin); if (u.origin === origin) return u.href; } catch {}
  return null;
}

function findLegalLinksInHTML(html, origin) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const all = [...doc.querySelectorAll("a[href]")];
  const hits = new Set();
  for (const a of all) {
    const text = (a.innerText || a.textContent || "").trim();
    const href = a.getAttribute("href") || "";
    if (!href) continue;
    if (!/\b(terms?|tos|privacy|policy|policies|legal|eula|cookie|conditions)\b/i.test(text + " " + href)) continue;
    const abs = absolutize(origin, href);
    if (abs) hits.add(abs);
  }
  return [...hits];
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "OFFSCREEN_PARSE") {
    try {
      const { html, origin, baseUrl, wantLinks } = msg;
      const title = extractTitle(html, baseUrl);
      const text = cleanTextFromHTML(html);
      const links = wantLinks ? findLegalLinksInHTML(html, origin) : [];
      sendResponse({ ok: true, title, text, links });
    } catch (e) {
      sendResponse({ ok: false, error: e.message || String(e) });
    }
    return true;
  }
});
