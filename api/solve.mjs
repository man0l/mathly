/**
 * POST /api/solve — solve a math problem from text or a photo.
 * Server-side only: holds the OpenAI key, never bundled into the app.
 *
 * Request:  { text?, imageBase64?, profile? }
 * Response: { problemText, subject, finalAnswer, method, steps[], graph?, concepts[] }
 */
const MODEL = process.env.OPENAI_MODEL ?? 'gpt-5.4-mini';
const SYSTEM_PROMPT = `You are Mathly, an expert math tutor. Given a problem (as text and/or a photo), solve it and return STRICT JSON only — no markdown fences.

Schema:
{
  "problemText": string,
  "subject": "algebra" | "calculus" | "geometry" | "statistics" | "physics" | "chemistry" | "trigonometry" | "other",
  "finalAnswer": string,
  "method": string,
  "concepts": string[],
  "steps": [
    { "title": string, "expression": string, "detail": string }
  ],
  "graph": { "expression": string, "xMin": number, "xMax": number } | null
}

Rules:
- problemText: restatement of the problem as clean text.
- finalAnswer: concise, unicode math ok (√, ², ≤, ±, ·). Never LaTeX.
- steps: 3-7 steps, each teaches ONE move. expression: the math of that step. detail: 1-3 sentences on WHY.
- graph.expression must be plain JavaScript-in-Math syntax of y in terms of x with explicit * for multiplication, using ^ for powers (e.g. "2*x^2 - 5*x - 3"). Include a graph only when it genuinely helps (functions, equations with real roots).
- Match the student's level from the context note.
- If the image is unreadable, return { "error": "unreadable" }.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method not allowed' });
  }

  const { text, imageBase64, profile } = req.body ?? {};

  if (!text && !imageBase64) {
    return res.status(400).json({ error: 'text or imageBase64 required' });
  }

  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });
  }

  const userContent = [];
  if (imageBase64) {
    userContent.push({
      type: 'image_url',
      image_url: { url: `data:image/jpeg;base64,${String(imageBase64).replace(/^data:image\/\w+;base64,/, '')}` },
    });
  }
  const profileNote = profile
    ? `\n\nStudent context: level=${profile.level ?? 'high school'}; prefers ${profile.explainStyle ?? 'step-by-step'} explanations; studying ${(profile.subjects ?? []).join(', ') || 'general math'}.`
    : '';
  userContent.push({
    type: 'text',
    text: `${text ? `Solve this problem: ${text}` : 'Solve the problem in this photo.'}${profileNote}`,
  });

  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!r.ok) {
      const errText = await r.text();
      console.error('openai error', r.status, errText.slice(0, 400));
      return res.status(502).json({ error: `upstream ${r.status}` });
    }

    const data = await r.json();
    const raw = data.choices?.[0]?.message?.content ?? '{}';
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return res.status(502).json({ error: 'unparseable model output' });
    }

    if (parsed.error || !parsed.finalAnswer) {
      return res.status(422).json({ error: parsed.error ?? 'no solution' });
    }

    return res.status(200).json({
      problemText: parsed.problemText,
      subject: parsed.subject ?? 'other',
      finalAnswer: parsed.finalAnswer,
      method: parsed.method,
      steps: parsed.steps ?? [],
      graph: parsed.graph ?? null,
      concepts: parsed.concepts ?? [],
    });
  } catch (e) {
    console.error('solve failed', e);
    return res.status(500).json({ error: 'solve failed' });
  }
}
