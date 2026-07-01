const Score = require("../models/Score");
const User  = require("../models/User");

const saveScore = async (req, res) => {
  try {
    const { topic, score, total, wrong, skipped, mode } = req.body;
    if (score === undefined || !total || !topic) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const percentage = Math.round((score / total) * 100);
    const newScore = await Score.create({
      user:     req.user._id,
      username: req.user.username,
      topic,
      score,
      total,
      wrong:    wrong   ?? 0,
      skipped:  skipped ?? 0,
      percentage,
      mode:     mode ?? "solo",
    });

    // ── Mark user active for daily reminder cron ──────────────────────
    const user = await User.findById(req.user._id);
    user.markActive();
    user.updateStreak();
    await user.save();

    // ── Calculate rank change for leaderboard notification ────────────
    let rankData = null;
    if (user.notificationPrefs?.leaderboardUpdates && user.isPublic) {
      rankData = await getRankChange(req.user._id);
    }

    res.status(201).json({ success: true, data: newScore, rankData });
  } catch (err) {
    console.error("Save score error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ── Helper: get current rank from the leaderboard aggregate ──────────
async function getRankChange(userId) {
  const leaderboard = await Score.aggregate([
    {
      $group: {
        _id:          "$user",
        totalCorrect: { $sum: "$score" },
      },
    },
    {
      $lookup: {
        from: "users", localField: "_id", foreignField: "_id", as: "userInfo",
      },
    },
    { $unwind: "$userInfo" },
    { $match: { "userInfo.isPublic": { $ne: false } } },
    { $sort: { totalCorrect: -1 } },
  ]);

  const idx = leaderboard.findIndex((u) => u._id.toString() === userId.toString());
  return idx === -1 ? null : { rank: idx + 1, total: leaderboard.length };
}

const getMyScores = async (req, res) => {
  try {
    const scores = await Score.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);

    const total        = scores.length;
    const avgScore     = total > 0 ? Math.round(scores.reduce((s, x) => s + x.percentage, 0) / total) : 0;
    const bestScore    = total > 0 ? Math.max(...scores.map((s) => s.percentage)) : 0;
    const totalCorrect = scores.reduce((s, x) => s + x.score, 0);

    // Topic breakdown
    const topicMap = {};
    scores.forEach((s) => {
      if (!topicMap[s.topic]) topicMap[s.topic] = { total: 0, count: 0 };
      topicMap[s.topic].total += s.percentage;
      topicMap[s.topic].count += 1;
    });

    const topicAverages = Object.entries(topicMap).map(([topic, data]) => ({
      topic,
      avgScore: Math.round(data.total / data.count),
      attempts: data.count,
    })).sort((a, b) => b.avgScore - a.avgScore);

    const bestSkill  = topicAverages[0] ?? null;
    const worstSkill = topicAverages.length > 1
      ? topicAverages[topicAverages.length - 1]
      : null;

    res.status(200).json({
      success: true,
      data: {
        scores,
        stats: { total, avgScore, bestScore, totalCorrect },
        topicAverages,
        bestSkill,
        worstSkill,
      },
    });
  } catch (err) {
    console.error("Get my scores error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const getTopics = async (req, res) => {
  try {
    const ranked = await Score.aggregate([
      { $group: { _id: "$topic", attempts: { $sum: 1 } } },
      { $sort: { attempts: -1, _id: 1 } },
    ]);

    const topics = ranked.map((t) => t._id);
    res.status(200).json({ success: true, data: topics });
  } catch (err) {
    console.error("Get topics error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── Get leaderboard — overall or per topic 
const getLeaderboard = async (req, res) => {
  try {
    const { topic } = req.query;

    const matchStage = topic && topic !== "overall"
      ? { $match: { topic } }
      : null;

    const pipeline = [
      ...(matchStage ? [matchStage] : []),
      {
        $group: {
          _id:          "$user",
          username:     { $first: "$username" },
          avgScore:     { $avg: "$percentage" },
          bestScore:    { $max: "$percentage" },
          totalQuizzes: { $sum: 1 },
          totalCorrect: { $sum: "$score" },
        },
      },
      
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "userInfo",
        },
      },
      { $unwind: "$userInfo" },
      
      { $match: { "userInfo.isPublic": { $ne: false } } },
      {
        $project: {
          username:     1,
          avgScore:     { $round: ["$avgScore", 1] },
          bestScore:    1,
          totalQuizzes: 1,
          totalCorrect: 1,
        },
      },
      { $sort: { totalCorrect: -1 } },
      { $limit: 50 },
    ];

    const leaderboard = await Score.aggregate(pipeline);
    res.status(200).json({ success: true, data: leaderboard });
  } catch (err) {
    console.error("Leaderboard error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = { saveScore, getMyScores, getLeaderboard, getTopics };