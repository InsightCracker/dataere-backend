const mongoose = require('mongoose');

const pricingPlanSchema = new mongoose.Schema({
  planId: {
    type: String,
    enum: ['monthly', 'quarterly', 'yearly'],
    required: true,
    unique: true
  },
  durationDays: { type: Number, required: true },

  prices: {
    NGN: {
      amount: { type: Number, required: true },
      processor: { type: String, default: 'paystack' }
    },
    USD: {
      amount: { type: Number, required: true },
      processor: { type: String, default: 'stripe' }
    },
    INR: {
      amount: { type: Number, required: true },
      processor: { type: String, default: 'stripe' }
    }
  }
});

module.exports = mongoose.model('PricingPlan', pricingPlanSchema);