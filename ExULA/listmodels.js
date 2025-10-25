// listModels.js
import "dotenv/config";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const listModels = async () => {
  const models = await genAI.listModels();
  models.forEach((m) => console.log(m.name));
};

listModels();
