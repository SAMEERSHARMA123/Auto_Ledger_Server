import Expense from "../models/Expense.js";
import { parseSpokenExpenses } from "../services/gemini.service.js";

export const logVoiceExpense = async (req, res) => {
  try {
    const { transcript } = req.body;
    if (!transcript?.trim()) {
      return res.status(400).json({ message: "No speech text provided" });
    }

    const parsedItems = await parseSpokenExpenses(transcript);
    if (!Array.isArray(parsedItems) || parsedItems.length === 0) {
      return res.status(422).json({ message: "Could not detect any expenses" });
    }

    const itemsToSave = parsedItems.map((item) => ({
      ...item,
      userId: req.user.id,
      date: new Date(),
    }));

    const savedItems = await Expense.insertMany(itemsToSave);

    res.status(201).json({
      message: "Expenses logged",
      expenses: savedItems,
    });
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to process voice expense" });
  }
};