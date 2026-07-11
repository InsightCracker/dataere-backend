const { getDatasetQuizAccess } = require('../utils/datasetQuizAccess');
const User = require('../models/User');

async function checkDatasetQuizAccess(req, res, next) {
  let user = req.user;
  const access = getDatasetQuizAccess(user);

  if (access.needsReset) {
    user = await User.findByIdAndUpdate(
      user._id,
      { 'datasetQuiz.freeQuizzesUsed': 0, 'datasetQuiz.lastResetAt': new Date() },
      { new: true }
    );
  }

  if (!access.allowed) {
    return res.status(403).json({
      error: 'FREE_LIMIT_REACHED',
      message: 'You\'ve used your 3 free dataset quizzes this month.',
      remaining: 0,
      resetsOn: nextMonthStart()
    });
  }

  req.datasetQuizAccess = access;
  req.user = user;
  next();
}

function nextMonthStart() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 1);
}

module.exports = checkDatasetQuizAccess;