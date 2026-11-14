import { GoogleGenAI, Type } from '@google/genai';

// Initialize the SDK with your API Key (from .env)
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Define the exact JSON schema we want Gemini to return
const expenseSchema = {
    type: Type.OBJECT,
    properties: {
        amount: { 
            type: Type.NUMBER, 
            description: "The total numerical amount spent or received." 
        },
        type: { 
            type: Type.STRING, 
            enum: ["EXPENSE", "INCOME"],
            description: "Whether money went out (EXPENSE) or came in (INCOME)." 
        },
        category: { 
            type: Type.STRING, 
            description: "The expense category (e.g., Food, Transport, Utilities, Shopping, Salary). Default to 'Miscellaneous' if unsure." 
        },
        paymentMethod: { 
            type: Type.STRING, 
            enum: ["CASH", "UPI", "CARD", "NET_BANKING"],
            description: "The method of payment. Default to UPI if not specified." 
        },
        notes: { 
            type: Type.STRING, 
            description: "A very brief, 3-5 word summary of the transaction." 
        },
        isDebtRelated: { 
            type: Type.BOOLEAN, 
            description: "True if the text mentions owing money, lending, borrowing, or paying back a person." 
        }
    },
    required: ["amount", "type", "category", "paymentMethod", "isDebtRelated"]
};

export const parseExpenseWithAI = async (textInput) => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: [
                {
                    role: 'user',
                    parts: [
                        { text: `Extract the financial transaction details from this text and return ONLY JSON: "${textInput}"` }
                    ]
                }
            ],
            config: {
                // Force the AI to output valid JSON matching our schema
                responseMimeType: "application/json",
                responseSchema: expenseSchema,
                temperature: 0.1 // Low temperature for factual extraction
            }
        });

        // The response.text() will be a stringified JSON. We parse it back to a JS object.
        return JSON.parse(response.text());
    } catch (error) {
        console.error("Gemini API Error:", error);
        throw new Error("Failed to parse input with AI");
    }
};

// (Upar wala parseExpenseWithAI code waisa hi rahega)

export const generateFinancialAdvice = async (financialData) => {
    try {
        // Data ko string mein convert karna prompt ke liye
        const dataString = JSON.stringify(financialData);
        
        const prompt = `
        You are an expert, slightly witty financial advisor. 
        Here is my spending data for this month: ${dataString}. 
        Give me exactly 3 short, punchy bullet points of advice or a "spending roast". 
        Don't use markdown formatting like asterisks. Just return 3 plain text sentences separated by a new line.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
                temperature: 0.7 // Thodi creativity ke liye
            }
        });

        // Split response by new line and filter out empty strings
        return response.text().split('\n').filter(line => line.trim() !== '');
    } catch (error) {
        console.error("Gemini Advisor Error:", error);
        throw new Error("Failed to generate AI advice");
    }
};