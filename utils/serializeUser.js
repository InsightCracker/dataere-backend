const serializeUser = (user) => ({
  id: user._id,
  username: user.username,
  email: user.email,
  streak: user.streak,
  longestStreak: user.longestStreak,
  totalCorrect: user.totalCorrect,
  joinDate: user.createdAt,
  isPublic: user.isPublic,
  notificationPrefs: user.notificationPrefs,
});

module.exports = { serializeUser };