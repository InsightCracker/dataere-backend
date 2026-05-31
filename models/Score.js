const mongoose = require("mongoose");

const scoreSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    username: {
      type: String,
      required: true,
    },
    topic: {
      type: String,
      required: true,
    },
    score: {
      type: Number,
      required: true,
    },
    total: {
      type: Number,
      required: true,
    },
    wrong: {
      type: Number,
      default: 0,
    },
    skipped: {
      type: Number,
      default: 0,
    },
    percentage: {
      type: Number,
      required: true,
    },
    mode: {
      type: String,
      enum: ["solo", "timed", "practice"],
      default: "solo",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Score", scoreSchema);