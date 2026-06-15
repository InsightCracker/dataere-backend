const mongoose = require("mongoose");

const DailyChallengeSchema = new mongoose.Schema({
  questions: { type: [mongoose.Schema.Types.Mixed], required: true },
  generatedAt: { type: Date, default: Date.now, expires: "24h" },
});

module.exports = mongoose.model("DailyChallenge", DailyChallengeSchema);