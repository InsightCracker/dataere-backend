const Score = require("../models/Score");

// ─── Save a score after quiz finishes 
const saveScore = async (req, res) => {
  try {
    const { topic, score, total, wrong, skipped, mode } = req.body;

    if (score === undefined || !total || !topic) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const percentage = Math.round((score / total) * 100);

    const newScore = await Score.create({
      user:       req.user._id,
      username:   req.user.username,
      topic,
      score,
      total,
      wrong:      wrong   ?? 0,
      skipped:    skipped ?? 0,
      percentage,
      mode:       mode ?? "solo",
    });

    res.status(201).json({ success: true, data: newScore });
  } catch (err) {
    console.error("Save score error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── Get scores for the logged-in user (profile page) 
const getMyScores = async (req, res) => {
  try {
    const scores = await Score.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(20);

    const total      = scores.length;
    const avgScore   = total > 0
      ? Math.round(scores.reduce((sum, s) => sum + s.percentage, 0) / total)
      : 0;
    const bestScore  = total > 0
      ? Math.max(...scores.map((s) => s.percentage))
      : 0;
    const totalCorrect = scores.reduce((sum, s) => sum + s.score, 0);

    // Group scores by topic and calculate average per topic
    const topicMap = {};
    scores.forEach((s) => {
    if (!topicMap[s.topic]) {
      topicMap[s.topic] = { total: 0, count: 0 };
    }
    topicMap[s.topic].total += s.percentage;
    topicMap[s.topic].count += 1;
    });

    const topicAverages = Object.entries(topicMap).map(([topic, data]) => ({
    topic,
    avgScore: Math.round(data.total / data.count),
    attempts: data.count,
    }));

    // Sort by average score
    topicAverages.sort((a, b) => b.avgScore - a.avgScore);

    const bestSkill  = topicAverages[0]  ?? 
      { topic: "N/A", avgScore: 0, attempts: 0 };
    const worstSkill = topicAverages[topicAverages.length - 1] ?? 
    { topic: "N/A", avgScore: 0, attempts: 0 };

    res.status(200).json({
    success: true,
    data: {
      scores,
      stats: { total, avgScore, bestScore, totalCorrect },
      topicAverages,  // full list — useful for a chart
      bestSkill,      // { topic: "SQL", avgScore: 92, attempts: 4 }
      worstSkill,     // { topic: "Python", avgScore: 41, attempts: 2 }
    },
    });
  } catch (err) {
    console.error("Get my scores error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── Get leaderboard (top 20 users by average score) 
const getLeaderboard = async (req, res) => {
  try {
    const leaderboard = await Score.aggregate([
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
        $project: {
          username:     1,
          avgScore:     { $round: ["$avgScore", 1] },
          bestScore:    1,
          totalQuizzes: 1,
          totalCorrect: 1,
        },
      },
      { $sort: { avgScore: -1 } }, // highest average first
      { $limit: 20 },
    ]);

    res.status(200).json({ success: true, data: leaderboard });
  } catch (err) {
    console.error("Leaderboard error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = { saveScore, getMyScores, getLeaderboard };