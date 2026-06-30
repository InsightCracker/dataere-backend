const express  = require("express");
const passport = require("passport");
const router   = express.Router();
const { generateToken } = require("../utils/jwt");
const {
  register, login, getMe, updateProfile, updatePrivacy,
  deleteAccount, forgotPassword, resetPassword,
} = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");

router.post("/register", register);
router.post("/login", login);
router.get("/me", protect, getMe);
router.put("/profile", protect, updateProfile);
router.put("/privacy", protect, updatePrivacy);
router.delete("/account", protect, deleteAccount);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);

// ── Google OAuth 
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"], session: false })
);

router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: `${process.env.CLIENT_URL}/users/login?error=oauth_failed`,
  }),
  oauthCallbackHandler
);

// ── GitHub OAuth 
router.get(
  "/github",
  passport.authenticate("github", { scope: ["user:email"], session: false })
);

router.get(
  "/github/callback",
  passport.authenticate("github", {
    session: false,
    failureRedirect: `${process.env.CLIENT_URL}/users/login?error=oauth_failed`,
  }),
  oauthCallbackHandler
);

// Shared handler: issue a JWT and bounce back to the frontend with it
function oauthCallbackHandler(req, res) {
  const user = req.user;
  user.updateStreak();
  user.save({ validateBeforeSave: false });

  const token = generateToken(user._id);
  res.redirect(`${process.env.CLIENT_URL}/users/oauth/callback?token=${token}`);
}

module.exports = router;