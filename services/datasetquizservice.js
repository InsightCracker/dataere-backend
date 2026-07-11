const Dataset = require("../models/Dataset");
const { phraseQuestion } = require("./groqService");

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

/**
 * EASY: single-condition COUNT.
 * "How many rows have [column] = [value]?"
 */
function buildEasyQuestion(dataset) {
  const categoricalCols = dataset.columns.filter((c) => c.type === "categorical");
  if (!categoricalCols.length) throw new Error("No categorical column available for Easy difficulty");

  const col = pickRandom(categoricalCols);
  const values = [...new Set(dataset.rows.map((r) => r[col.name]))].filter(Boolean);
  const value = pickRandom(values);

  const correctAnswer = dataset.rows.filter((r) => r[col.name] === value).length;

  // realistic wrong answers: off-by-a-few, and "count of a different value"
  const otherValue = pickRandom(values.filter((v) => v !== value)) || value;
  const wrongCountOtherValue = dataset.rows.filter((r) => r[col.name] === otherValue).length;

  const distractors = new Set([
    correctAnswer + 1,
    Math.max(correctAnswer - 1, 0),
    wrongCountOtherValue,
  ]);
  distractors.delete(correctAnswer);

  return {
    operationDescription: `Count how many rows have "${col.name}" equal to "${value}"`,
    correctAnswer,
    distractors: [...distractors].slice(0, 3),
  };
}

/**
 * HARD: two-condition SUM.
 * "What is the total [numericCol] where [col1]=[val1] AND [col2]=[val2]?"
 */
function buildHardQuestion(dataset) {
  const categoricalCols = dataset.columns.filter((c) => c.type === "categorical");
  const numericCols = dataset.columns.filter((c) => c.type === "numeric");
  if (categoricalCols.length < 2 || !numericCols.length) {
    throw new Error("Dataset needs 2+ categorical columns and 1+ numeric column for Hard difficulty");
  }

  const [col1, col2] = shuffle(categoricalCols).slice(0, 2);
  const numCol = pickRandom(numericCols);

  const val1 = pickRandom([...new Set(dataset.rows.map((r) => r[col1.name]))].filter(Boolean));
  const val2 = pickRandom([...new Set(dataset.rows.map((r) => r[col2.name]))].filter(Boolean));

  const matchingRows = dataset.rows.filter((r) => r[col1.name] === val1 && r[col2.name] === val2);
  const correctAnswer = Math.round(
    matchingRows.reduce((sum, r) => sum + (Number(r[numCol.name]) || 0), 0) * 100
  ) / 100;

  // realistic mistake distractors: ignoring one condition, wrong numeric column
  const onlyCol1Sum = Math.round(
    dataset.rows.filter((r) => r[col1.name] === val1).reduce((s, r) => s + (Number(r[numCol.name]) || 0), 0) * 100
  ) / 100;

  const otherNumCol = numericCols.find((c) => c.name !== numCol.name);
  const wrongColumnSum = otherNumCol
    ? Math.round(matchingRows.reduce((s, r) => s + (Number(r[otherNumCol.name]) || 0), 0) * 100) / 100
    : correctAnswer + 10;

  const distractors = new Set([
    onlyCol1Sum,
    wrongColumnSum,
    Math.round(correctAnswer * 1.1 * 100) / 100,
  ]);
  distractors.delete(correctAnswer);

  return {
    operationDescription: `Sum "${numCol.name}" for rows where "${col1.name}" = "${val1}" AND "${col2.name}" = "${val2}"`,
    correctAnswer,
    distractors: [...distractors].slice(0, 3),
  };
}

async function generateDatasetQuestions({ datasetId, userId, tool, difficulty, count = 5 }) {
  const dataset = await Dataset.findOne({ _id: datasetId, user: userId });
  if (!dataset) throw new Error("Dataset not found or not owned by this user");

  const builder = difficulty === "hard" ? buildHardQuestion : buildEasyQuestion;

  const questions = [];
  let attempts = 0;

  while (questions.length < count && attempts < count * 3) {
    attempts++;
    try {
      const { operationDescription, correctAnswer, distractors } = builder(dataset);

      // pad distractors if fewer than 3 unique ones were generated
      while (distractors.length < 3) {
        distractors.push(correctAnswer + distractors.length + 1);
      }

      const questionText = await phraseQuestion({
        tool,
        difficulty,
        operationDescription,
        correctAnswer,
        distractors,
      });

      const options = shuffle([correctAnswer, ...distractors]).map((val) => ({
        value: val,
        isCorrect: val === correctAnswer,
      }));

      questions.push({ questionText, options, tool, difficulty });
    } catch (err) {
      console.error("Skipping a question due to build error:", err.message);
    }
  }

  if (!questions.length) {
    throw new Error("Could not generate any questions from this dataset — check column types");
  }

  return questions;
}

module.exports = { generateDatasetQuestions };