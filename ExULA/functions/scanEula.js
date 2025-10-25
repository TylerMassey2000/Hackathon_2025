// functions/scanEula.js
import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "./firebase.js";

// ✅ Use environment variable (set in Firebase with `firebase functions:secrets:set GEMINI_API_KEY`)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ✅ Use stable Gemini model
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

export async function scanEula(companyName, eulaText) {
  console.log(`🔍 Scanning ${companyName} with Google Gemini 2.5 Flash-Lite...`);

  const prompt = `
You are an expert EULA and Privacy Policy analyzer.

Analyze the following EULA and summarize its data-handling practices.

Return ONLY a JSON object with exactly the following fields:

{
  "company_name": "",
  "privacy_score": 0,
  "risk_level": "",
  "summary": "",
  "categories": [],
  "red_flags": [],
  "recommendations": []
}

EULA TEXT:
${eulaText}
`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  // Try to parse AI output safely
  let json;
  try {
    json = JSON.parse(text);
  } catch (err) {
    console.error("❌ Failed to parse AI response:", err);
    json = { company_name: companyName, summary: text };
  }

  // ✅ Save to Firestore using admin syntax
  const companyRef = db.collection("companies").doc(companyName.toLowerCase());
  await companyRef.set({
    ...json,
    company_name: companyName,
    last_scanned: new Date().toISOString(),
  });

  console.log(`✅ Saved analysis for ${companyName}`);
  return json;
}
