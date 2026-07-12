// Run once, after deploying the totalCorrect schema change:
//   node scripts/backfillTotalCorrect.js
//
// Populates User.totalCorrect for all existing users from their historical
// Score documents, so profile pages don't show 0 XP until they play again.

require("dotenv").config();
const mongoose = require("mongoose");
const Score = require("../models/Score");
const User  = require("../models/User");

async function backfill() {
  await mongoose.connect(process.env.MONGO_URI);

  const totals = await Score.aggregate([
    { $group: { _id: "$user", totalCorrect: { $sum: "$score" } } },
  ]);

  for (const t of totals) {
    await User.findByIdAndUpdate(t._id, { totalCorrect: t.totalCorrect });
  }

  console.log(`Backfilled ${totals.length} users.`);
  await mongoose.disconnect();
}

backfill().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});