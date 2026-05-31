const express = require("express");
const router  = express.Router();
const { saveScore, getMyScores, getLeaderboard } = require("../controllers/scoreController");
const { protect } = require("../middleware/authMiddleware");

router.post("/", protect, saveScore);      // POST /api/scores
router.get("/me", protect, getMyScores);    // GET  /api/scores/me
router.get("/leaderboard", getLeaderboard); // GET  /api/scores/leaderboard (public)

module.exports = router;