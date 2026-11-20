import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const parseAudioExpenses = async (audioBase64, mimeType = "audio/webm") => {
  const prompt = `
    Listen to this English/Hinglish audio and extract all expenses mentioned.
    Return a strict JSON array matching this exact schema:
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
    - If the audio is unclear, silent, or has NO valid numeric amount, return [].
    - Default paymentMethod to "UPI" and category to "OTHER" if not mentioned.
    - Keep notes short and clean (e.g., "Chai samosa", "Petrol").
    - Set isDebtRelated to true only if words like udhaar, debt, split, or borrowed are spoken.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash-lite", 
    contents: [
      { inlineData: { data: audioBase64, mimeType } },
      { text: prompt },
    ],
    config: {
      responseMimeType: "application/json",
    },
  });

  return JSON.parse(response.text);
};