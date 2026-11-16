
import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true 
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
        type: String
    },
    isDebtRelated: {
        type: Boolean,
        default: false 
    }
}, { timestamps: true });

export default mongoose.model('Expense', expenseSchema);