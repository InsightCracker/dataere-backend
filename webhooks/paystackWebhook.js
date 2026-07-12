// const crypto = require('crypto');
// const User = require('../models/User');
// const PricingPlan = require('../models/PricingPlan');

// async function handlePaystackWebhook(req, res) {
//   const signature = req.headers['x-paystack-signature'];
//   const expected = crypto
//     .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
//     .update(req.body)
//     .digest('hex');

//   if (signature !== expected) {
//     return res.status(401).send('Invalid signature');
//   }

//   const event = JSON.parse(req.body);

//   if (event.event === 'charge.success') {
//     const { userId, planId } = event.data.metadata;
//     const plan = await PricingPlan.findOne({ planId });
//     const expiresAt = new Date(Date.now() + plan.durationDays * 24 * 60 * 60 * 1000);

//     await User.findByIdAndUpdate(userId, {
//       'datasetQuiz.isSubscribed': true,
//       'datasetQuiz.subscriptionExpiresAt': expiresAt,
//       'datasetQuiz.subscriptionPlan': planId,
//       'datasetQuiz.paymentProcessor': 'paystack',
//       'datasetQuiz.processorSubscriptionId': event.data.reference
//     });
//   }

//   res.sendStatus(200);
// }

// module.exports = handlePaystackWebhook;