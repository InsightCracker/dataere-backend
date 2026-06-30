const Score = require("../models/Score");

// ─── Save a score
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
    res.status(201).json({ success: true, data: newScore });
  } catch (err) {
    console.error("Save score error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── Get my scores + stats + skill analysis 
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

// ─── Get all unique topics (for topic filter tabs) 
const getTopics = async (req, res) => {
  try {
    const topics = await Score.distinct("topic");
    res.status(200).json({ success: true, data: topics.sort() });
  } catch (err) {
    console.error("Get topics error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── Get leaderboard — overall or per topic 
const getLeaderboard = async (req, res) => {
  try {
    const { topic } = req.query; // ?topic=SQL  or omit for overall

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
      
      // Exclude users who opted out of the public leaderboard. Default to
      // showing users where isPublic was never set (legacy accounts).
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