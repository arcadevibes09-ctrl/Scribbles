// FILE: src/myNotesStudio/aiRouter.js
import { aiEngine } from '../ai/localAI';
import { structureRawTextToSuru } from './noteFormatter';

const KEYS_STORAGE = 'suru_ai_api_keys_v1';

export const AI_PROVIDERS = [
  {
    id: 'gemini',
    name: 'Gemini 2.5 Flash',
    badge: 'FAST • FREE TIER',
    needsKey: true,
    keyPlaceholder: 'Paste Google AI Studio Key (AIza...)'
  },
  {
    id: 'groq',
    name: 'Groq (Llama 3.3 70B)',
    badge: 'ULTRA FAST',
    needsKey: true,
    keyPlaceholder: 'Paste Groq API Key (gsk_...)'
  },
  {
    id: 'openai',
    name: 'OpenAI (GPT-4o Mini)',
    badge: 'OPENAI',
    needsKey: true,
    keyPlaceholder: 'Paste OpenAI Key (sk-...)'
  },
  {
    id: 'local',
    name: 'Suru Local / Termux AI',
    badge: 'OFFLINE / LOCALHOST',
    needsKey: false
  }
];

export function loadSavedApiKeys() {
  try {
    const raw = localStorage.getItem(KEYS_STORAGE);
    return raw ? JSON.parse(raw) : { gemini: '', groq: '', openai: '' };
  } catch {
    return { gemini: '', groq: '', openai: '' };
  }
}

export function saveApiKeys(keys) {
  try {
    localStorage.setItem(KEYS_STORAGE, JSON.stringify(keys));
  } catch {
    // ignore storage errors
  }
}

/**
 * Generates the exact prompt that teaches any AI how to output Suru OS notes.
 */
export function buildSuruStudyPrompt(studyRequest) {
  return `You are the Suru OS Study Architect. The user wants to study: "${studyRequest}".

Break this study request into logical sub-topics (chapters/units).
Use this EXACT formatting syntax inside your response:
1. Start each sub-topic with: ===CHAPTER: [Sub-Topic Title]===
2. Inside each chapter, use "## Section Heading" for headings.
3. Wrap important technical terms with inline definitions like this: [[Term Name::Clear 1-sentence definition]].
4. Wrap critical rules or warnings in double curly braces: {{Critical rule or warning here.}}
5. Wrap clinical pearls, formulas, or high-yield summaries in triple brackets: [[[Clinical Pearl or Formula box here.]]]
6. Insert [PAGE] between major sections (roughly every 220 words).

Write rich, high-yield, deeply explanatory notes now:`;
}

/**
 * Parses a multi-chapter AI response into a Suru Deck with multiple Topic Items.
 */
export function parseAIResponseIntoDeck(rawReply, fallbackDeckTitle = 'AI Study Deck') {
  const chapterRegex = /===CHAPTER:\s*(.+?)===/gi;
  const parts = rawReply.split(chapterRegex);

  const topics = [];

  if (parts.length > 1) {
    // parts[0] is preamble, then pairs of (chapterTitle, chapterBody)
    for (let i = 1; i < parts.length; i += 2) {
      const chTitle = (parts[i] || `Unit ${Math.ceil(i / 2)}`).trim();
      const chBody = (parts[i + 1] || '').trim();
      if (!chBody) continue;

      const structured = structureRawTextToSuru(chBody, chTitle);
      topics.push({
        id: `ai_top_${Date.now()}_${i}`,
        title: chTitle,
        subtitle: fallbackDeckTitle,
        text: structured.text,
        glossary: structured.glossary
      });
    }
  }

  // Fallback if the AI didn't use ===CHAPTER:=== markers
  if (topics.length === 0) {
    const structured = structureRawTextToSuru(rawReply, fallbackDeckTitle);
    topics.push({
      id: `ai_top_${Date.now()}_0`,
      title: fallbackDeckTitle,
      subtitle: 'AI Generated Unit',
      text: structured.text,
      glossary: structured.glossary
    });
  }

  return {
    id: `deck_ai_${Date.now()}`,
    title: fallbackDeckTitle.toUpperCase(),
    subtitle: `${topics.length} Study Units • AI Generated`,
    badge: `${topics.length} UNITS`,
    createdAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    sourceType: 'AI',
    topics
  };
}

/**
 * Calls the selected AI provider (Backend -> Device API Key -> Local ONNX fallback)
 */
export async function generateStudyDeckFromAI({
  studyRequest,
  providerId,
  apiKeys,
  onStatus
}) {
  const fullPrompt = buildSuruStudyPrompt(studyRequest);

  // 1. Try local Termux backend first if user chose 'local' or as primary bridge
  if (providerId === 'local') {
    onStatus && onStatus('Checking Termux / Local AI server...');
    const reply = await aiEngine.ask(
      fullPrompt,
      'You are Suru OS Study Generator. Output structured notes with ## Headings, [[Term::Definition]], {{Highlights}}, [[[Boxes]]], and [PAGE].',
      (_, txt) => onStatus && onStatus(txt)
    );
    return parseAIResponseIntoDeck(reply, studyRequest);
  }

  // 2. Gemini Direct Device Call
  if (providerId === 'gemini') {
    const key = apiKeys?.gemini?.trim();
    if (!key) throw new Error('Please enter your Gemini API Key or switch to Paste / Local mode.');
    onStatus && onStatus('Requesting Gemini 2.5 Flash...');

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }],
          generationConfig: { temperature: 0.4 }
        })
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini API Error (${res.status}): ${errText.slice(0, 120)}`);
    }
    const data = await res.json();
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return parseAIResponseIntoDeck(reply, studyRequest);
  }

  // 3. Groq Direct Device Call
  if (providerId === 'groq') {
    const key = apiKeys?.groq?.trim();
    if (!key) throw new Error('Please enter your Groq API Key.');
    onStatus && onStatus('Requesting Groq Llama-3.3-70B...');

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: fullPrompt }],
        temperature: 0.4
      })
    });

    if (!res.ok) throw new Error(`Groq Error (${res.status})`);
    const data = await res.json();
    const reply = data?.choices?.[0]?.message?.content || '';
    return parseAIResponseIntoDeck(reply, studyRequest);
  }

  // 4. OpenAI Direct Device Call
  if (providerId === 'openai') {
    const key = apiKeys?.openai?.trim();
    if (!key) throw new Error('Please enter your OpenAI API Key.');
    onStatus && onStatus('Requesting OpenAI GPT-4o-mini...');

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: fullPrompt }],
        temperature: 0.4
      })
    });

    if (!res.ok) throw new Error(`OpenAI Error (${res.status})`);
    const data = await res.json();
    const reply = data?.choices?.[0]?.message?.content || '';
    return parseAIResponseIntoDeck(reply, studyRequest);
  }

  throw new Error('Unknown AI provider selected.');
}
