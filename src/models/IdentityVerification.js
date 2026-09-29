const mongoose = require('mongoose');

const identityVerificationSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      unique: true,
    },
    kycType: {
      type: String,
      enum: ['bvn', 'nin'],
      required: true,
    },
    // Synthetic identifiers only. Never put real BVNs or NINs in this assignment.
    kycID: {
      type: String,
      required: true,
      unique: true,
      select: false,
    },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    dob: { type: String, required: true }, // YYYY-MM-DD
    status: {
      type: String,
      enum: ['verified'],
      default: 'verified',
    },
    verifiedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  'IdentityVerification',
  identityVerificationSchema
);