const express = require("express");
const DailyChallenge = require("../models/DailyChallenge");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const cached = await DailyChallenge.findOne({
      generatedAt: { $gte: since },
    }).sort({ generatedAt: -1 });

    if (cached) return res.json({ questions: cached.questions });

    res.json({ questions: null });
  } catch (err) {
    res.status(500).json({ error: "Failed to check questions" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { questions } = req.body;
    if (!questions?.length) {
      return res.status(400).json({ error: "No questions provided" });
    }

    const saved = await DailyChallenge.create({ questions });
    res.json({ questions: saved.questions });
  } catch (err) {
    res.status(500).json({ error: "Failed to save questions" });
  }
});

module.exports = router;