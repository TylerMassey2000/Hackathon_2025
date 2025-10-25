import functions from "firebase-functions";
import fetch from "node-fetch";

// ✅ NEW FUNCTION
export const analyzeEULA = functions.https.onRequest(async (req, res) => {
  const { eulaText } = req.body;

  if (!eulaText) {
    return res.status(400).json({ error: "Missing EULA text" });
  }

  const prompt = `
  Analyze the following End User License Agreement (EULA) for privacy and data risk.
  Include:
  - Data collection & tracking behaviors
  - Third-party sharing
  - Legal loopholes or vague clauses
  - Risk summary with a Privacy Score (0 = safe, 100 = invasive)
  
  EULA:
  ${eulaText}
  `;

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=AIzaSyCGqpzxslB7HLCIWV2ltPNkVZcW97dd4dU",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Gemini API error:", error);
    res.status(500).json({ error: "Failed to analyze EULA" });
  }
});
