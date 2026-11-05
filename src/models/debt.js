import mongoose from 'mongoose';

const settlementSchema = new mongoose.Schema({
    amount: { type: Number, required: true },
    date: { type: Date, default: Date.now },
    notes: { type: String }
});

const debtSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    personName: {
        type: String,
        required: true,
        trim: true
    },
    type: {
        type: String,
        enum: ['LENT', 'BORROWED'], // LENT = Aapne diye, BORROWED = Aapne liye
        required: true
    },
    principalAmount: {
        type: Number,
        required: true
    },
    remainingAmount: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['PENDING', 'PARTIALLY_PAID', 'SETTLED'],
        default: 'PENDING'
    },
    dueDate: {
        type: Date
    },
    settlements: [settlementSchema], // History of partial payments
    notes: {
        type: String
    }
}, { timestamps: true });

export default mongoose.model('Debt', debtSchema);