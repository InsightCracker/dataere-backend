const express = require("express");
const router = express.Router();
const User = require("../models/User");
const { protect } = require("../middleware/authMiddleware");

router.patch("/", protect, async (req, res) => {
  const { key, value } = req.body;

  const allowed = ["dailyReminders", "leaderboardUpdates"];
  if (!allowed.includes(key)) {
    return res.status(400).json({ success: false, message: "Invalid preference key" });
  }

  try {
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { [`notificationPrefs.${key}`]: value } },
      { returnDocument: 'after' }
    );

    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        streak: user.streak,
        longestStreak: user.longestStreak,
        joinDate: user.createdAt,
        isPublic: user.isPublic,
        notificationPrefs: user.notificationPrefs,
      },
    });
  } catch (err) {
    console.error("Notif pref error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;