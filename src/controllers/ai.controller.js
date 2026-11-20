import Expense from "../models/Expense.js";
import { parseAudioExpenses } from "../services/gemini.service.js";

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
          .map((item) => ({
            amount: item.amount,
            type: "EXPENSE",
            category: ["FOOD", "TRAVEL", "BILLS", "SHOPPING", "OTHER"].includes(item.category)
              ? item.category
              : "OTHER",
            paymentMethod: ["UPI", "CASH", "CARD"].includes(item.paymentMethod)
              ? item.paymentMethod
              : "UPI",
            notes: item.notes?.trim() || item.category || "Voice Expense",
            isDebtRelated: Boolean(item.isDebtRelated),
            userId: req.user.id,
            date: new Date(),
          }))
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