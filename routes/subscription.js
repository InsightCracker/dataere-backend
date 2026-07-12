// routes/subscription.js
const express = require("express");
const router = express.Router();
const PricingPlan = require("../models/PricingPlan");
const { protect } = require("../middleware/authMiddleware");
const { initPaystackTransaction } = require("../services/paystackService");
const { createStripeCheckoutSession } = require("../services/stripeService");

router.post("/checkout", protect, async (req, res) => {
  try {
    const { planId } = req.body; // 'monthly' | 'quarterly' | 'yearly'
    const currency = req.user.preferredCurrency || "NGN";

    const plan = await PricingPlan.findOne({ planId });
    if (!plan) return res.status(400).json({ error: "INVALID_PLAN" });

    const priceInfo = plan.prices[currency];
    if (!priceInfo) return res.status(400).json({ error: "CURRENCY_NOT_SUPPORTED" });

    if (priceInfo.processor === "paystack") {
      const authUrl = await initPaystackTransaction({
        email: req.user.email,
        amount: priceInfo.amount, // kobo
        metadata: { userId: req.user._id.toString(), planId },
      });
      return res.json({ processor: "paystack", checkoutUrl: authUrl });
    }

    if (priceInfo.processor === "stripe") {
      const session = await createStripeCheckoutSession({
        customerEmail: req.user.email,
        amount: priceInfo.amount, // cents/paise
        currency: currency.toLowerCase(),
        metadata: { userId: req.user._id.toString(), planId },
      });
      return res.json({ processor: "stripe", checkoutUrl: session.url });
    }

    return res.status(400).json({ error: "NO_PROCESSOR_CONFIGURED" });
  } catch (err) {
    console.error("Checkout initiation failed:", err);
    res.status(500).json({ error: "CHECKOUT_FAILED" });
  }
});

module.exports = router;