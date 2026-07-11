// services/paystackService.js
const https = require("https");

/**
 * Initializes a Paystack transaction and returns the checkout URL to redirect
 * the user to. Amount must already be in kobo (smallest unit), matching
 * what's stored in PricingPlan.
 */
function initPaystackTransaction({ email, amount, metadata }) {
  return new Promise((resolve, reject) => {
    const params = JSON.stringify({
      email,
      amount, // kobo
      metadata,
      callback_url: process.env.PAYSTACK_CALLBACK_URL, // e.g. https://dataere.vercel.app/payment/verify
    });

    const options = {
      hostname: "api.paystack.co",
      port: 443,
      path: "/transaction/initialize",
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (!parsed.status) {
            return reject(new Error(parsed.message || "Paystack initialization failed"));
          }
          resolve(parsed.data.authorization_url);
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on("error", reject);
    req.write(params);
    req.end();
  });
}

module.exports = { initPaystackTransaction };