import { GoogleGenAI } from "@google/genai";
import Expense from "../models/Expense.js";
import User from "../models/User.js"; // aapke User model ka path
import { parseAudioExpenses } from "../services/gemini.service.js";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

function toDeclarativeTitle(rawNotes, category) {
  const words = String(rawNotes || "")
    .replace(/[^\w\s-]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length >= 2) {
    return words.slice(0, 3).join(" ");
  }

  const base = words[0] || category || "Expense";
  return `${base} Expense`;
}

function buildFallbackWeeklySummary({
  weekKey,
  totalSpend,
  entryCount,
  topCategory,
  topCategoryPercent,
}) {
  if (!totalSpend || entryCount === 0) {
    return {
      headline: `Week ${weekKey} Wrap-Up`,
      summary:
        "Is week koi naya expense record nahi hua. Agle week ke daily kharch aur categories track karne ke liye entries log karte rahein.",
    };
  }

  return {
    headline: `Week ${weekKey} Spending Digest`,
    summary: `Is week aapka kul kharch ₹${Number(totalSpend).toLocaleString("en-IN")} (${entryCount} entries) raha. Sabse zyada kharch ${topCategory || "GENERAL"} (${topCategoryPercent || 0}%) category mein hua—apne budget aur daily burn rate ko balance rakhne ke liye is category par nazar rakhein.`,
  };
}

export const logVoiceExpense = async (req, res) => {
  try {
    const { audioBase64, mimeType } = req.body;
    if (!audioBase64) {
      return res.status(400).json({ message: "No audio provided" });
    }

    const parsedItems = await parseAudioExpenses(audioBase64, mimeType);

    // Strict validation: sirf valid amount wale items hi save honge
    const validItems = Array.isArray(parsedItems)
      ? parsedItems
          .filter((item) => typeof item.amount === "number" && item.amount > 0)
          .map((item) => {
            const category = ["FOOD", "TRAVEL", "BILLS", "SHOPPING", "OTHER"].includes(item.category)
              ? item.category
              : "OTHER";

            return {
              amount: item.amount,
              type: "EXPENSE",
              category,
              paymentMethod: ["UPI", "CASH", "CARD"].includes(item.paymentMethod)
                ? item.paymentMethod
                : "UPI",
              notes: toDeclarativeTitle(item.notes, category),
              isDebtRelated: Boolean(item.isDebtRelated),
              userId: req.user.id,
              date: new Date(),
            };
          })
      : [];

    if (validItems.length === 0) {
      return res.status(422).json({ message: "Could not hear a valid expense" });
    }

    const savedItems = await Expense.insertMany(validItems);

    res.status(201).json({
      message: "Expenses logged",
      expenses: savedItems,
    });
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to process voice expense" });
  }
};

export const generateWeeklySummary = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const {
      weekKey,
      totalSpend = 0,
      entryCount = 0,
      topCategory = "NONE",
      topCategoryPercent = 0,
      categories = [],
      force = false,
    } = req.body;

    if (!weekKey) {
      return res.status(400).json({ message: "weekKey is required (e.g. 2026-W48)" });
    }

    const user = userId ? await User.findById(userId) : null;

    if (
      !force &&
      user?.lastWeeklySummaryWeek === weekKey &&
      user?.weeklySummaryData?.summary
    ) {
      return res.status(200).json({
        ...user.weeklySummaryData,
        weekKey,
        cached: true,
        source: "gemini",
      });
    }

    const fallback = buildFallbackWeeklySummary({
      weekKey,
      totalSpend,
      entryCount,
      topCategory,
      topCategoryPercent,
    });

    let generated = fallback;
    let source = "local-fallback";

    if (process.env.GEMINI_API_KEY) {
      try {
        const prompt = `
You are a concise, helpful personal finance assistant for an Indian expense tracker app (INR ₹).
Analyze this weekly spending data and return ONLY valid JSON with keys "headline" (short 4-6 word title) and "summary" (3-4 clear, informative sentences with actionable spending insights, no markdown code fences).

Data:
- Week: ${weekKey}
- Total Spend: ₹${totalSpend}
- Entry Count: ${entryCount}
- Top Category: ${topCategory} (${topCategoryPercent}%)
- Category Breakdown: ${JSON.stringify(categories)}
        `.trim();

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
        });

        const rawText = (response.text || "").trim();
        const cleanedJson = rawText
          .replace(/^```json\s*/i, "")
          .replace(/```$/i, "")
          .trim();
        const parsed = JSON.parse(cleanedJson);

        if (parsed?.headline && parsed?.summary) {
          generated = {
            headline: String(parsed.headline).slice(0, 90),
            summary: String(parsed.summary).slice(0, 600),
          };
          source = "gemini";
        }
      } catch (geminiErr) {
        console.error(
          "Gemini weekly summary fallback triggered:",
          geminiErr?.message || geminiErr
        );
      }
    }

    if (user) {
      user.lastWeeklySummaryWeek = weekKey;
      user.weeklySummaryData = {
        headline: generated.headline,
        summary: generated.summary,
        generatedAt: new Date(),
      };
      await user.save();
    }

    return res.status(200).json({
      weekKey,
      headline: generated.headline,
      summary: generated.summary,
      cached: false,
      source,
    });
  } catch (error) {
    console.error("Weekly summary route error:", error);
    return res.status(500).json({ message: "Failed to generate weekly summary" });
  }
};