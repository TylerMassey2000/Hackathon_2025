// shared.js — Gemini 2.5 Flash (REST), aggressive top-5 scoring, clean output

export const COMMON_PATHS = [
  "/terms", "/terms-of-service", "/terms-of-use", "/tos",
  "/privacy", "/privacy-policy",
  "/legal", "/policies", "/policy", "/eula",
  "/support/terms", "/support/privacy", "/support/legal",
  "/about/terms", "/about/privacy", "/company/terms", "/company/privacy"
];

export const LINK_TEXT_RE = /\b(terms?|tos|privacy|policy|policies|legal|eula|cookie|cookies|data|safety|security|guidelines|community)\b/i;

export function toOrigin(urlString) { try { return new URL(urlString).origin; } catch { return null; } }
export function absolutize(origin, pathOrUrl) { try { const u = new URL(pathOrUrl, origin); if (u.origin === origin) return u.href; } catch {} return null; }
export function uniq(arr) { return [...new Set(arr)].filter(Boolean); }
export function wordCount(s) { return (s.trim().match(/\S+/g) || []).length; }

const CAT_ORDER = ["terms","privacy","legal","policy","cookie","safety","security","guidelines","other"];
export function categorize(url) {
  const p = url.toLowerCase();
  if (/terms-of|terms|tos/.test(p)) return "terms";
  if (/privacy/.test(p)) return "privacy";
  if (/legal/.test(p)) return "legal";
  if (/polic(y|ies)/.test(p)) return "policy";
  if (/cookie/.test(p)) return "cookie";
  if (/safety/.test(p)) return "safety";
  if (/security/.test(p)) return "security";
  if (/guidelines|community/.test(p)) return "guidelines";
  return "other";
}
export function sortByCategoryPriority(urls) {
  return [...urls].sort((a,b) => CAT_ORDER.indexOf(categorize(a)) - CAT_ORDER.indexOf(categorize(b)));
}

/* -------------------- Fuzzy clause harvesting -------------------- */

const CLUSTERS = [
  { name: "collection",  re: /\b(collect|gather|obtain|receive|acquire)\b.*\b(data|information|identifiers?|content|usage)\b/i, w: 4 },
  { name: "sharing",     re: /\b(share|disclose|transfer|provide|sell|broker)\b.*\b(data|information)\b/i, w: 6 },
  { name: "thirdparty",  re: /\b(third[-\s]?part(y|ies)|affiliates|partners|vendors|advertisers|analytics)\b/i, w: 5 },
  { name: "tracking",    re: /\b(track|tracking|pixel|beacon|cookie|sdk|fingerprint|profil(e|ing)|cross[-\s]?site)\b/i, w: 6 },
  { name: "retention",   re: /\b(retain|store|keep|preserve)\b.*\b(as long as|indefinite|necessary|required)\b/i, w: 5 },
  { name: "consent",     re: /\b(consent|permission|opt[-\s]?out|opt[-\s]?in)\b/i, w: 3 },
  { name: "sensitive",   re: /\b(precise location|biometric|genetic|health|financial|children|minor|ssn)\b/i, w: 7 },
  { name: "combine",     re: /\b(combine|link|associate)\b.*\b(data|information|datasets?)\b/i, w: 4 },
  { name: "control",     re: /\b(access|delete|erase|port|restrict|object)\b.*\b(request|right|ability|may refuse)\b/i, w: 4 },
  { name: "security",    re: /\b(security|breach|unauthorized)\b/i, w: 2 },
  { name: "information", re: /\b(information (you provide|we collect|we receive|we use|we share|about you))\b/i, w: 5 }
];

const BROAD_TOUCH = /\b(data|information|privacy|identifier|cookie|advertis|analytics|usage|content|profile)\b/i;

function scoreSentence(s) {
  let score = 0;
  for (const c of CLUSTERS) if (c.re.test(s)) score += c.w;
  if (BROAD_TOUCH.test(s)) score += 1;
  if (/we may/i.test(s)) score += 1;
  if (s.length > 300) score -= 1;
  return score;
}

export function extractDataClauses(text) {
  const sentences = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .filter(s => s && s.trim().length > 0 && s.length < 900);

  const scored = sentences.map(s => ({ sentence: s.trim(), score: scoreSentence(s) }))
                          .filter(x => x.score > 0);

  const seen = new Set();
  const unique = [];
  for (const x of scored) {
    const k = x.sentence.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    unique.push(x);
  }

  unique.sort((a,b) => b.score - a.score);
  if (unique.length < 100) {
    const fallback = sentences.slice(0, 120);
    for (const s of fallback) unique.push({ sentence: s });
  }

  return unique.slice(0, 300).map(x => ({ sentence: x.sentence }));
}

/* -------------------- Gemini 2.5 Flash Top-5 (R3-Pro, W1, EXTRAPOLATION, D1, Always-5) -------------------- */

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent";

/**
 * Category mapping to enforce D1 (distinct themes)
 */
const CATEGORY_KEYS = [
  { key: "profiling", re: /\b(profile|profiling|behavioral|cross[-\s]?site|identity linking|tracking)\b/i },
  { key: "thirdparty", re: /\b(third[-\s]?party|partners|vendors|advertisers|affiliates|sharing)\b/i },
  { key: "law", re: /\b(law enforcement|government|subpoena|court|legal request|compliance)\b/i },
  { key: "retention", re: /\b(retain|retention|store|storage|preserve|archiv)\b/i },
  { key: "ai", re: /\b(train|training data|ai model|machine learning)\b/i },
  { key: "sensitive", re: /\b(biometric|location|children|health|financial|sensitive)\b/i },
  { key: "breach", re: /\b(breach|unauthorized|security|exposure|leak)\b/i }
  // any unmatched category will fall into "misc" but still dedupe by first-occurrence
];

function classifyCategory(text) {
  for (const c of CATEGORY_KEYS) {
    if (c.re.test(text)) return c.key;
  }
  return "misc";
}

export async function aiTop5DataViolations({ url, clauses }) {
  const { aiProvider, geminiKey } = await chrome.storage.local.get(["aiProvider", "geminiKey"]);
  if (aiProvider !== "gemini" || !geminiKey) return { items: [], raw: "" };

  const ctx = clauses.map(c => `• ${c.sentence}`).join("\n");

  const prompt =
    "ROLE: You are a professional privacy risk analyst.\n" +
    "Analyze the policy clauses below and identify the FIVE MOST SERIOUS user-data risks.\n" +
    "\n" +
    "MODE (R3-Pro, Worst-Case Professional):\n" +
    "- Focus on serious risks: cross-site profiling, identity correlation, third-party access, law-enforcement access,\n" +
    "  resale of data, indefinite retention, sensitive data misuse, AI training without consent, breach exposure.\n" +
    "- DO NOT include low-impact issues (cookies, parental controls, simple analytics, general service usage).\n" +
    "- If risks are vague, extrapolate a reasonable worst-case implication.\n" +
    "- ALWAYS produce exactly five distinct risks.\n" +
    "- Each risk must be a different category (profiling, law access, retention, sharing, etc.).\n" +
    "\n" +
    "OUTPUT RULES:\n" +
    "- Return STRICT JSON ONLY.\n" +
    "- Format:\n" +
    '[{"title":"Short punchy title","clause":"one-sentence summary","harm":"1–2 sentence plain-English impact","severity":1-10}]\n' +
    "- Tone: professional, serious, no exaggeration vocabulary.\n" +
    "- Severity: 8–10 major, 5–7 moderate. Never <5.\n" +
    "- NO commentary outside the JSON.\n" +
    "\n" +
    `URL: ${url}\nCLAUSES:\n${ctx}`;

  const body = {
    contents: [ { parts: [ { text: prompt } ] } ]
  };

  const resp = await fetch(`${GEMINI_URL}?key=${geminiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const j = await resp.json();
  const raw = j?.candidates?.[0]?.content?.parts?.map(p => p.text).join("\n") || "";

  // Parse JSON
  let items = [];
  try {
    const match = raw.match(/\[[\s\S]*\]/);
    if (match) {
      const arr = JSON.parse(match[0]);
      // Clean + enforce D1 uniqueness
      const seenCats = new Set();
      for (const x of arr) {
        const cat = classifyCategory((x.title || "") + " " + (x.clause || ""));
        if (seenCats.has(cat)) continue;
        seenCats.add(cat);
        items.push({
          title: String(x.title || "").trim(),
          clause: String(x.clause || "").replace(/\s+/g," ").trim(),
          harm: String(x.harm || "").replace(/\s+/g," ").trim(),
          severity: Math.max(5, Math.min(10, parseInt(x.severity,10) || 5))
        });
        if (items.length === 5) break;
      }
    }
  } catch {}

  return { items, raw };
}
