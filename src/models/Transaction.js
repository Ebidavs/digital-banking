const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true,
    },
    requestId: { type: String, required: true },
    fromAccount: { type: String, required: true },
    toAccount: { type: String, required: true },
    recipientName: { type: String, required: true },
    amount: { type: String, required: true },
    providerTransactionId: { type: String },
    status: {
      type: String,
      enum: ['pending', 'successful', 'failed', 'needs_review'],
      default: 'pending',
    },
    providerStatus: { type: String },
  },
  { timestamps: true }
);

transactionSchema.index(
  { customerId: 1, requestId: 1 },
  { unique: true }
);

module.exports = mongoose.model('Transaction', transactionSchema);