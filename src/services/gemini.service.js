import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const parseSpokenExpenses = async (text) => {
  const prompt = `
    Extract one or multiple expenses from this spoken English/Hinglish text: "${text}"
    Return a strict JSON array of objects matching this exact schema:
    [
      {
        "amount": Number,
        "type": "EXPENSE",
        "category": "FOOD" | "TRAVEL" | "BILLS" | "SHOPPING" | "OTHER",
        "paymentMethod": "UPI" | "CASH" | "CARD",
        "notes": String,
        "isDebtRelated": Boolean
      }
    ]
    Rules:
    - Default paymentMethod to "UPI" if not mentioned.
    - Default category to "OTHER" if unclear.
    - Keep notes short and clean (e.g., "Chai samosa", "Petrol").
    - Set isDebtRelated to true only if words like udhaar, debt, split, or borrowed are mentioned.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
    },
  });

  return JSON.parse(response.text);
};