// config/ai.js
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

// ✅ Make sure we read the API key directly (not wrapped in an object)
if (!process.env.GEMINI_API_KEY) {
  throw new Error("❌ GEMINI_API_KEY is missing from .env");
}

// ✅ Correct initialization
const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default ai;
