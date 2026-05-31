const express = require("express");
const router  = express.Router();
const { saveScore, getMyScores, getLeaderboard, getTopics } = require("../controllers/scoreController");
const { protect } = require("../middleware/authMiddleware");

router.post("/",             protect, saveScore);
router.get("/me",            protect, getMyScores);
router.get("/leaderboard",            getLeaderboard);
router.get("/topics",                 getTopics);

module.exports = router;