// routes/datasetQuiz.js
const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/AuthMiddleware");
const checkDatasetQuizAccess = require("../middleware/checkDatasetQuizAccess");
const upload = require("../middleware/upload");
const { getDatasetQuizAccess } = require("../utils/datasetQuizAccess");
const { parseDatasetBuffer } = require("../services/datasetParser");
const { generateDatasetQuestions } = require("../services/datasetQuizService");
const Dataset = require("../models/Dataset");
const User = require("../models/User");

// Step 1: upload + parse a dataset, store it, return its ID.
// Not gated by the free-quiz limit — parsing is cheap; generation is what's metered.
router.post("/upload", protect, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "NO_FILE_PROVIDED" });

    const { columns, rows, rowCount } = parseDatasetBuffer(req.file.buffer, req.file.originalname);

    const dataset = await Dataset.create({
      user: req.user._id,
      originalFilename: req.file.originalname,
      columns,
      rows,
      rowCount,
    });

    res.json({
      datasetId: dataset._id,
      columns: dataset.columns,
      rowCount: dataset.rowCount,
    });
  } catch (err) {
    console.error("Dataset upload/parse failed:", err.message);
    res.status(400).json({ error: "PARSE_FAILED", message: err.message });
  }
});

// Step 2: generate questions from a previously uploaded dataset. Gated.
router.post("/generate", protect, checkDatasetQuizAccess, async (req, res) => {
  try {
    const { datasetId, tool, difficulty } = req.body;

    const questions = await generateDatasetQuestions({
      datasetId,
      userId: req.user._id,
      tool,
      difficulty,
    });

    if (!req.datasetQuizAccess.isSubscribed) {
      await User.findByIdAndUpdate(req.user._id, {
        $inc: { "datasetQuiz.freeQuizzesUsed": 1 },
      });
    }

    res.json({
      questions,
      remaining: req.datasetQuizAccess.isSubscribed ? null : req.datasetQuizAccess.remaining - 1,
    });
  } catch (err) {
    console.error("Dataset quiz generation failed:", err.message);
    res.status(500).json({ error: "GENERATION_FAILED", message: err.message });
  }
});

router.get("/access-status", protect, (req, res) => {
  const access = getDatasetQuizAccess(req.user);
  res.json(access);
});

module.exports = router;