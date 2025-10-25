import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenerativeAI } from "@google/generative-ai";


dotenv.config();


// --- basic express setup ---
const app = express();
app.use(express.json({ limit: "2mb" })); // allow JSON body from ai.js


// So we can figure out the directory of this file (because we're using ES modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// 1. Serve static files (your html, css, js, images, etc.)
app.use(express.static(__dirname));


/**
 * Helper: if user only gives a URL, try to pull that policy text.
 * We rely on built-in fetch (Node 18+).
 */
async function fetchPolicyTextFromUrl(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Accept": "text/html,text/plain;q=0.9,*/*;q=0.8"
    }
  });


  if (!res.ok) {
    throw new Error("Couldn't load policy URL");
  }


  const txt = await res.text();
  return txt;
}


/**
 * Helper: actually ask Gemini to analyze this policy text.
 * We tell Gemini to return JSON with the fields our frontend expects.
 */
async function analyzeWithGemini({ company, policyText }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY in .env");
  }


  const genAI = new GoogleGenerativeAI(apiKey);


// Use a text model that works with generateContent
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });




  const prompt = `
You are an automated consumer protection scanner.
Read the policy text below and respond ONLY with valid JSON that matches this schema:


{
  "company": string,
  "severity": "high" | "medium" | "low",
  "severityScore": number,  // 0-100 how sneaky / anti-consumer this sounds
  "summary": string,
  "findings": [
    {
      "category": string,
      "description": string,
      "riskLevel": "high" | "medium" | "low"
    }
  ]
}


How to score:
- If it has forced arbitration, waiver of right to sue/class action, always-on listening/voice collection,
  selling or sharing personal data with "partners", or "we can change this any time with no notice":
  severity = "high", severityScore 70-100.
- If it's mostly tracking/ads/analytics but not extreme rights waivers:
  severity = "medium", 40-69.
- If nothing major stands out:
  severity = "low", 0-39.


The company name to include: "${company}"


POLICY TEXT STARTS HERE:
----------------
${policyText}
----------------
POLICY TEXT ENDS HERE.
`;


  const result = await model.generateContent(prompt);
  const raw = result.response.text();


  // We expect raw to be JSON text. We'll parse it.
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    // Fallback: try to slice first {...} block
    const firstBrace = raw.indexOf("{");
    const lastBrace = raw.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1) {
      const candidate = raw.slice(firstBrace, lastBrace + 1);
      parsed = JSON.parse(candidate);
    } else {
      throw new Error("Gemini did not return valid JSON");
    }
  }


  // Safety defaults so frontend never explodes
  if (!parsed.findings) parsed.findings = [];
  if (typeof parsed.severityScore !== "number") parsed.severityScore = 0;


  return parsed;
}


/**
 * 2. POST /scan
 * This is what ai.js calls when you press "Run Scan"
 */
app.post("/scan", async (req, res) => {
  try {
    const { company, policyUrl, policyText } = req.body || {};


    // validate like ai.js does
    if (!company) {
      return res.status(400).json({ message: "Missing company name." });
    }
    if (!policyUrl && !policyText) {
      return res.status(400).json({ message: "Need policyUrl or policyText." });
    }


    // get the text we will analyze
    let textToAnalyze = policyText && policyText.trim() ? policyText.trim() : "";
    if (!textToAnalyze && policyUrl) {
      textToAnalyze = await fetchPolicyTextFromUrl(policyUrl);
    }


    if (!textToAnalyze) {
      return res.status(400).json({ message: "Could not get any policy text to analyze." });
    }


    // send to Gemini
    const geminiResult = await analyzeWithGemini({
      company,
      policyText: textToAnalyze
    });


    // send JSON back to browser
    res.json(geminiResult);


  } catch (err) {
    console.error("SCAN ERROR:", err);
    res.status(500).json({
      message: err.message || "Server error during scan."
    });
  }
});


// 3. Start the server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
