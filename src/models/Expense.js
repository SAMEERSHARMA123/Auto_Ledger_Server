
import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true // Index for faster queries
    },
    amount: {
        type: Number,
        required: true
    },
    type: {
        type: String,
        enum: ['EXPENSE', 'INCOME'],
        default: 'EXPENSE'
    },
    category: {
        type: String,
        required: true
    },
    paymentMethod: {
        type: String,
        enum: ['CASH', 'UPI', 'CARD', 'NET_BANKING'],
        default: 'UPI'
    },
    date: {
        type: Date,
        default: Date.now
    },
    notes: {
        type: String,
        trim: true
    },
    receiptUrl: {
        type: String // Gemini OCR receipt scanning ke future use ke liye
    },
    isDebtRelated: {
        type: Boolean,
        default: false // Agar dosto ke beech ka udhaar hai toh true hoga
    }
}, { timestamps: true });

export default mongoose.model('Expense', expenseSchema);