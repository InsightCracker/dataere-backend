const Groq = require("groq-sdk");
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const MODEL_BY_DIFFICULTY = {
  easy: "llama-3.1-8b-instant",
  hard: "openai/gpt-oss-20b",
};

/**
 * Asks Groq to phrase a natural-language question + plausible wrong-answer
 * labels. The CORRECT answer is never trusted from the LLM — it's inserted
 * by our own code after this call. This function only produces wording.
 */
async function phraseQuestion({ tool, difficulty, operationDescription, correctAnswer, distractors }) {
  const model = MODEL_BY_DIFFICULTY[difficulty] || MODEL_BY_DIFFICULTY.easy;

  const prompt = `You are writing a multiple-choice practice question for someone learning ${tool}.

Task performed: ${operationDescription}

Write ONLY a JSON object with this exact shape, nothing else, no markdown fences:
{"questionText": "a natural, ${tool}-flavored question describing this task"}

Do not mention or restate any numeric answers. Just phrase the question naturally, as if asking the learner to figure it out themselves in ${tool}.`;

  try {
    const completion = await groq.chat.completions.create({
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 200,
      temperature: 0.7,
    });

    const raw = completion.choices[0]?.message?.content?.trim() || "";
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return parsed.questionText;
  } catch (err) {
    console.error("Groq phrasing failed, using fallback template:", err.message);
    return operationDescription; // fallback keeps the feature working even if Groq fails
  }
}

module.exports = { phraseQuestion };