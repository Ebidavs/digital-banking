const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      unique: true,
    },
    accountNumber: {
      type: String,
      unique: true,
      sparse: true,
    },
    bankCode: String,
    bankName: String,
    status: {
      type: String,
      enum: ['creating', 'active', 'needs_review'],
      default: 'creating',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Account', accountSchema);