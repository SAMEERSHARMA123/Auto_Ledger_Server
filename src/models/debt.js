import mongoose from 'mongoose';

const debtEntrySchema = new mongoose.Schema(
  {
    note: { type: String, trim: true, default: 'Udhaar Entry' },
    amount: { type: Number, required: true, min: 1 },
    remainingAmount: { type: Number, required: true, min: 0 },
    date: { type: Date, default: Date.now },
    dueDate: { type: Date },
    status: {
      type: String,
      enum: ['ACTIVE', 'SETTLED'],
      default: 'ACTIVE',
    },
    settledAt: { type: Date },
  },
  { _id: true, timestamps: true }
);

const debtAccountSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    personName: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['LENT', 'BORROWED'], // LENT = To Receive, BORROWED = To Pay
      required: true,
    },
    entries: [debtEntrySchema],
  },
  { timestamps: true }
);

debtAccountSchema.index({ userId: 1, personName: 1, type: 1 });

export default mongoose.model('DebtAccount', debtAccountSchema);