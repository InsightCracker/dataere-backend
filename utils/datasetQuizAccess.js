function isSameMonth(date1, date2) {
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth();
}

function getDatasetQuizAccess(user) {
  const now = new Date();
  const { freeQuizzesUsed, freeQuizzesLimit, isSubscribed, subscriptionExpiresAt, lastResetAt } = user.datasetQuiz;

  const subscriptionActive = isSubscribed &&
    (!subscriptionExpiresAt || subscriptionExpiresAt > now);

  if (subscriptionActive) {
    return { allowed: true, remaining: null, isSubscribed: true, needsReset: false };
  }

  const needsReset = !isSameMonth(new Date(lastResetAt), now);
  const effectiveUsed = needsReset ? 0 : freeQuizzesUsed;

  const remaining = Math.max(freeQuizzesLimit - effectiveUsed, 0);
  return { allowed: remaining > 0, remaining, isSubscribed: false, needsReset };
}

module.exports = { getDatasetQuizAccess };