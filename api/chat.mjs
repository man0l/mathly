/**
 * POST /api/chat — tutor follow-up / general chat.
 * Request:  { messages: [{role, text}], profile?, solutionContext? }
 * Response: { reply }
 */
const MODEL = process.env.OPENAI_MODEL ?? 'gpt-5.4-mini';
const SYSTEM_PROMPT = `You are Mathly, a warm, concise math tutor inside a mobile app. Answer in 2-5 short sentences unless the student asks for a full derivation. Use unicode math (√, ², ≤, ±, ·), never LaTeX. Guide understanding — don't just dump answers unless asked. If the student is stuck, ask one focused question back.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method not allowed' });
  }

  const { messages, profile, solutionContext } = req.body ?? {};

  if (!messages?.length) {
    return res.status(400).json({ error: 'messages required' });
  }

  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });
  }

  const context = [
    profile?.level ? `Student level: ${profile.level}.` : '',
    profile?.explainStyle ? `Prefers ${profile.explainStyle} explanations.` : '',
    solutionContext
      ? `Currently discussing the problem "${solutionContext.problemText}" whose answer is ${solutionContext.finalAnswer}.`
      : '',
  ]
    .filter(Boolean)
    .join(' ');

  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: `${SYSTEM_PROMPT}${context ? `\n\nContext: ${context}` : ''}` },
          ...messages.map((m) => ({
            role: m.role === 'tutor' ? 'assistant' : 'user',
            content: m.text,
          })),
        ],
      }),
    });

    if (!r.ok) {
      const errText = await r.text();
      console.error('openai error', r.status, errText.slice(0, 400));
      return res.status(502).json({ error: `upstream ${r.status}` });
    }

    const data = await r.json();
    return res.status(200).json({ reply: data.choices?.[0]?.message?.content ?? '…' });
  } catch (e) {
    console.error('chat failed', e);
    return res.status(500).json({ error: 'chat failed' });
  }
}
