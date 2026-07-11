// webhooks/stripeWebhook.js
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const User = require('../models/User');
const PricingPlan = require('../models/PricingPlan');

async function handleStripeWebhook(req, res) {
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.headers['stripe-signature'],
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).send(`Webhook signature verification failed: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { userId, planId } = session.metadata;

    const plan = await PricingPlan.findOne({ planId });
    const expiresAt = new Date(Date.now() + plan.durationDays * 24 * 60 * 60 * 1000);

    await User.findByIdAndUpdate(userId, {
      'datasetQuiz.isSubscribed': true,
      'datasetQuiz.subscriptionExpiresAt': expiresAt,
      'datasetQuiz.subscriptionPlan': planId,
      'datasetQuiz.paymentProcessor': 'stripe',
      'datasetQuiz.processorSubscriptionId': session.id
    });
  }

  res.sendStatus(200);
}

module.exports = handleStripeWebhook;