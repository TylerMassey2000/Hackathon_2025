// functions/index.js
import * as functions from "firebase-functions";
import admin from "firebase-admin";
import { GoogleGenerativeAI } from "@google/generative-ai";

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

async function fetchPolicyTextFromUrl(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Accept": "text/html,text/plain;q=0.9,*/*;q=0.8"
    }
  });
  if (!res.ok) throw new Error("Couldn't load policy URL");
  return await res.text();
}

async function analyzeWithGemini({ company, policyText }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `
You are an automated consumer protection scanner.
Return ONLY valid JSON matching:
{
  "company": string,
  "severity": "high" | "medium" | "low",
  "severityScore": number,
  "summary": string,
  "findings": [{"category": string, "description": string, "riskLevel": "high"|"medium"|"low"}]
}
Company: ${company}

----- POLICY TEXT START -----
${policyText}
----- POLICY TEXT END -----
`;
  const result = await model.generateContent(prompt);
  const raw = result.response.text();

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const a = raw.indexOf("{"), b = raw.lastIndexOf("}");
    if (a !== -1 && b !== -1) parsed = JSON.parse(raw.slice(a, b + 1));
    else throw new Error("Gemini did not return valid JSON");
  }

  if (!parsed.findings) parsed.findings = [];
  if (typeof parsed.severityScore !== "number") parsed.severityScore = 0;
  if (!parsed.severity) parsed.severity = "low";
  if (!parsed.company) parsed.company = company;

  await db.collection("companies").doc(company.toLowerCase()).set({
    ...parsed,
    last_scanned: new Date().toISOString()
  });

  return parsed;
}

// ✅ 1st-Gen export style
export const analyzeEULA = functions.https.onRequest(async (req, res) => {
  try {
    if (req.method !== "POST")
      return res.status(405).send("Method Not Allowed");

    const { company, policyUrl, policyText } = req.body || {};
    if (!company)
      return res.status(400).json({ message: "Missing company name." });
    if (!policyUrl && !policyText)
      return res.status(400).json({ message: "Need policyUrl or policyText." });

    let text = (policyText || "").trim();
    if (!text && policyUrl) text = await fetchPolicyTextFromUrl(policyUrl);
    if (!text)
      return res.status(400).json({ message: "No policy text to analyze." });

    const out = await analyzeWithGemini({ company, policyText: text });
    res.json(out);
  } catch (err) {
    console.error("SCAN ERROR:", err);
    res
      .status(500)
      .json({ message: err.message || "Server error during scan." });
  }
});
