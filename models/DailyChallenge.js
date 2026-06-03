const mongoose = require("mongoose");

const DailyChallengeSchema = new mongoose.Schema({
  questions: { type: Array, required: true },
  generatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("DailyChallenge", DailyChallengeSchema);