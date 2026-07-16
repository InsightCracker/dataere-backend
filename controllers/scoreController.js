const Score = require("../models/Score");
const User  = require("../models/User");
const { serializeUser } = require("../utils/serializeUser");

const saveScore = async (req, res) => {
  try {
    const { topic, score, total, wrong, skipped, mode } = req.body;
    if (score === undefined || !total || !topic) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const percentage = Math.round((score / total) * 100);
    const newScore = await Score.create({
      user: req.user._id,
      username: req.user.username,
      topic,
      score,
      total,
      wrong: wrong   ?? 0,
      skipped: skipped ?? 0,
      percentage,
      mode: mode ?? "solo",
    });

    const user = await User.findById(req.user._id);
    user.updateStreak();
    user.totalCorrect = (user.totalCorrect ?? 0) + score;

    let rankData = null;
    let rankNotification = null;

    if (user.notificationPrefs?.leaderboardUpdates && user.isPublic) {
      rankData = await getRankChange(req.user._id);

      if (rankData) {
        const oldRank = user.lastRank;
        const newRank = rankData.rank;

        if (oldRank != null && newRank !== oldRank) {
          const direction = newRank < oldRank ? "up" : "down";
          rankNotification = {
            direction,
            oldRank,
            newRank,
            message:
              direction === "up"
                ? `You climbed to rank #${newRank}! 🎉`
                : `You dropped to rank #${newRank}.`,
          };
        }

        user.lastRank = newRank;
      }
    }

    await user.save();

    res.status(201).json({
      success: true,
      data: newScore,
      rankData,
      rankNotification, // ← frontend shows a toast if this isn't null
      user: serializeUser(user),
    });
  } catch (err) {
    console.error("Save score error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ── Helper: get current rank from the leaderboard aggregate
async function getRankChange(userId) {
  const leaderboard = await Score.aggregate([
    {
      $group: {
        _id: "$user",
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
    const allScores = await Score.find({ user: req.user._id })
      .sort({ createdAt: -1 });

    const [agg] = await Score.aggregate([
      { $match: { user: req.user._id } },
      {
        $group: {
          _id:          "$user",
          total:        { $sum: 1 },
          totalCorrect: { $sum: "$score" },
          avgScore:     { $avg: "$percentage" },
          bestScore:    { $max: "$percentage" },
        },
      },
    ]);

    const stats = agg
      ? {
          total:        agg.total,
          avgScore:     Math.round(agg.avgScore),
          bestScore:    agg.bestScore,
          totalCorrect: agg.totalCorrect,
        }
      : { total: 0, avgScore: 0, bestScore: 0, totalCorrect: 0 };

    const topicAgg = await Score.aggregate([
      { $match: { user: req.user._id } },
      {
        $group: {
          _id:      "$topic",
          avgScore: { $avg: "$percentage" },
          attempts: { $sum: 1 },
        },
      },
      { $sort: { avgScore: -1 } },
    ]);

    const topicAverages = topicAgg.map((t) => ({
      topic:    t._id,
      avgScore: Math.round(t.avgScore),
      attempts: t.attempts,
    }));

    const bestSkill  = topicAverages[0] ?? null;
    const worstSkill = topicAverages.length > 1
      ? topicAverages[topicAverages.length - 1]
      : null;

    res.status(200).json({
      success: true,
      data: {
        scores: allScores,
        stats,
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
      username:     "$userInfo.username", // ← live username goes here, not in $group
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

// ─── Get the current user's rank + XP — always computed, regardless of
// isPublic, and scoped to a topic if provided. Privacy only controls
// whether OTHER people can see this user on the shared leaderboard; it
// should never hide a user's own stats from themself.
const getMyRank = async (req, res) => {
  try {
    const { topic } = req.query;
    const matchStage = topic && topic !== "overall" ? { $match: { topic } } : null;

    const pipeline = [
      ...(matchStage ? [matchStage] : []),
      {
        $group: {
          _id:          "$user",
          totalCorrect: { $sum: "$score" },
        },
      },
      { $sort: { totalCorrect: -1 } },
    ];

    const leaderboard = await Score.aggregate(pipeline);
    const idx = leaderboard.findIndex(
      (u) => u._id.toString() === req.user._id.toString()
    );

    if (idx === -1) {
      return res.status(200).json({
        success: true,
        data: { rank: null, total: leaderboard.length, totalCorrect: 0 },
      });
    }

    res.status(200).json({
      success: true,
      data: {
        rank:         idx + 1,
        total:        leaderboard.length,
        totalCorrect: leaderboard[idx].totalCorrect,
      },
    });
  } catch (err) {
    console.error("Get my rank error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = { saveScore, getMyScores, getLeaderboard, getTopics, getMyRank };