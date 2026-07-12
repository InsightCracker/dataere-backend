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
    user.totalCorrect = (user.totalCorrect ?? 0) + score;   // ← keep XP in sync with scores
    await user.save();

    // ── Calculate rank change for leaderboard notification ────────────
    let rankData = null;
    if (user.notificationPrefs?.leaderboardUpdates && user.isPublic) {
      rankData = await getRankChange(req.user._id);
    }

    res.status(201).json({
      success: true,
      data: newScore,
      rankData,
      user: serializeUser(user),   // ← lets the frontend sync AuthContext in one round trip
    });
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
    // Full all-time score history — no limit. The profile page shows
    // everything the user has ever done, not just recent activity.
    const allScores = await Score.find({ user: req.user._id })
      .sort({ createdAt: -1 });

    // Lifetime stats — aggregated over ALL of the user's scores, same
    // semantics as getLeaderboard()'s aggregation, so the two numbers
    // always agree regardless of how many quizzes the user has played.
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

    // Topic breakdown — also aggregated over ALL scores, not just the
    // recent 50, so "best/worst skill" isn't skewed by recency either.
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