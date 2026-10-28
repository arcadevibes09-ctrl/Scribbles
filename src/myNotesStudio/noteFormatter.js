// FILE: src/myNotesStudio/noteFormatter.js

const WORDS_PER_PAGE = 220;

/**
 * Predicts whether a standalone line in a PDF/Book/AI text is actually a Heading or Subheading
 */
function isLikelyHeading(line, nextLine = '') {
  const clean = line.trim();
  if (!clean || clean.length > 78 || clean.length < 3) return false;

  // Already markdown heading
  if (/^#{1,4}\s+/.test(clean)) return true;

  // Explicit Chapter / Lesson / Principle / Step / Rule / Section headers
  if (
    /^(?:Chapter|Lesson|Part|Unit|Module|Section|Rule|Principle|Secret|Step|Phase|Law)\s+(?:\d+|[IVXLC]+|One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten)\b/i.test(
      clean
    )
  ) {
    return true;
  }

  // Numbered subheadings like "1. The Myth of Job Security" or "I. Assets vs Liabilities"
  if (/^(?:\d{1,2}|[IVX]{1,4})[.)]\s+[A-Z][A-Za-z0-9\s,'’-]{3,55}$/.test(clean) && !clean.endsWith('.')) {
    return true;
  }

  // Short ALL-CAPS line (at least 4 letters, no period at end)
  if (
    clean === clean.toUpperCase() &&
    /[A-Z]{4,}/.test(clean) &&
    clean.split(/\s+/).length <= 9 &&
    !clean.endsWith('.')
  ) {
    return true;
  }

  // Standalone Title-Case line followed by a blank line or long paragraph
  const words = clean.split(/\s+/);
  if (
    words.length >= 2 &&
    words.length <= 8 &&
    !/[.,;!?]$/.test(clean) &&
    /^[A-Z]/.test(clean) &&
    (!nextLine || nextLine.trim().length === 0 || nextLine.trim().length > 60)
  ) {
    const capCount = words.filter((w) => /^[A-Z]/.test(w)).length;
    if (capCount / words.length >= 0.65) return true;
  }

  return false;
}

/**
 * Advanced Format Predictor: Converts raw book text, PDFs, or shared AI output
 * into Suru's NotebookPage syntax (## Heading, [[Glossary]], {{Highlight}}, [[[Box]]], [PAGE])
 */
export function structureRawTextToSuru(rawText = '', defaultTitle = 'Study Unit') {
  if (!rawText || typeof rawText !== 'string') {
    return {
      title: defaultTitle,
      subtitle: 'Empty Unit',
      text: `## ${defaultTitle}\n\nNo content provided.`,
      glossary: {}
    };
  }

  let text = rawText
    .replace(/\r\n/g, '\n')
    // Fix broken PDF hyphenated line wraps: "invest-\nment" -> "investment"
    .replace(/([a-z])-\n([a-z])/g, '$1$2')
    .trim();

  const glossary = {};

  // 1. Extract explicit [[Term::Definition]] markers from Magic Prompt
  text = text.replace(/\[\[([^\]|:]+?)(?:::|\|)([^\]]+?)\]\]/g, (_, term, def) => {
    const cleanTerm = term.trim();
    glossary[cleanTerm] = def.trim();
    return `[[${cleanTerm}]]`;
  });

  // 2. Line-by-line pattern prediction
  const rawLines = text.split('\n');
  const outBlocks = [];
  let paragraphBuffer = [];

  const flushParagraph = () => {
    if (paragraphBuffer.length > 0) {
      outBlocks.push(paragraphBuffer.join(' '));
      paragraphBuffer = [];
    }
  };

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i].trim();
    const nextLine = rawLines[i + 1] || '';

    if (!line) {
      flushParagraph();
      continue;
    }

    // Keep explicit [PAGE] breaks
    if (line === '[PAGE]') {
      flushParagraph();
      outBlocks.push('[PAGE]');
      continue;
    }

    // Keep existing [[[Box]]] blocks
    if (line.startsWith('[[[') && line.endsWith(']]]')) {
      flushParagraph();
      outBlocks.push(line);
      continue;
    }

    // Predict Heading / Subheading
    if (isLikelyHeading(line, nextLine)) {
      flushParagraph();
      const cleanHeading = line.replace(/^#{1,4}\s+/, '').replace(/\*\*/g, '').trim();
      outBlocks.push(`## ${cleanHeading}`);
      continue;
    }

    // Predict Callout / Quote / Rule / Takeaway Box
    if (
      /^>\s+/.test(line) ||
      /^(?:Clinical Pearl|Key Takeaway|Rule|Formula|Remember|Lesson|Summary|Insight|Golden Rule)\s*[:—-]/i.test(
        line
      ) ||
      (/^["“].{25,220}["”]$/.test(line) && line.split(/\s+/).length <= 45)
    ) {
      flushParagraph();
      const cleanBox = line.replace(/^>\s+/, '').trim();
      outBlocks.push(`[[[${cleanBox}]]]`);
      continue;
    }

    // Predict Bold or Colon Definition: "**Asset**: Something that puts money in your pocket"
    const defMatch = line.match(
      /^(?:[-•*]\s*)?(?:\*\*([A-Za-z0-9\s\-()/]{3,38})\*\*|([A-Z][A-Za-z0-9\s\-()/]{2,32}))\s*[:—-]\s*(.{18,220})$/
    );
    if (defMatch) {
      const term = (defMatch[1] || defMatch[2] || '').trim();
      const def = defMatch[3].trim();
      if (term && term.split(/\s+/).length <= 5) {
        flushParagraph();
        if (!glossary[term]) glossary[term] = def;
        outBlocks.push(`• [[${term}]] — ${def}`);
        continue;
      }
    }

    // Bullet points stay separate lines for clean breathing space
    if (/^(?:[-•*]|\d+[.)])\s+/.test(line)) {
      flushParagraph();
      const cleanBullet = line.replace(/^[-*]\s+/, '• ');
      outBlocks.push(cleanBullet);
      continue;
    }

    paragraphBuffer.push(line);

    // If a paragraph gets long (> 85 words), flush it so the page has breathing room
    if (paragraphBuffer.join(' ').split(/\s+/).length > 85) {
      flushParagraph();
    }
  }
  flushParagraph();

  // 3. Auto-highlight high-value sentences if no {{highlights}} exist yet
  let structuredText = outBlocks.join('\n\n');
  if (!structuredText.includes('{{')) {
    structuredText = structuredText.replace(
      /(^|\.\s+)([^.\n[\]{}*]{25,165}?\b(?:important|never|always|key|secret|difference|remember|essential|must|rich|asset|liability|clinical|priority)\b[^.\n[\]{}*]{10,120}?\.)/gi,
      '$1{{$2}}'
    );
  }

  // 4. Paginate cleanly into [PAGE] chunks
  if (!structuredText.includes('[PAGE]')) {
    structuredText = paginateTextByParagraphs(structuredText, WORDS_PER_PAGE);
  }

  // Ensure first block starts with a ## Heading
  if (!structuredText.trim().startsWith('## ')) {
    structuredText = `## ${defaultTitle}\n\n` + structuredText;
  }

  return {
    title: defaultTitle,
    text: structuredText,
    glossary
  };
}

export function paginateTextByParagraphs(text, maxWordsPerPage = WORDS_PER_PAGE) {
  const blocks = text
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  const pages = [];
  let currentBlocks = [];
  let currentWords = 0;

  blocks.forEach((block) => {
    const words = block.split(/\s+/).length;
    const isHeading = block.startsWith('## ');

    if (
      (currentWords + words > maxWordsPerPage && currentBlocks.length > 0) ||
      (isHeading && currentWords > 115)
    ) {
      pages.push(currentBlocks.join('\n\n'));
      currentBlocks = [block];
      currentWords = words;
    } else {
      currentBlocks.push(block);
      currentWords += words;
    }
  });

  if (currentBlocks.length > 0) {
    pages.push(currentBlocks.join('\n\n'));
  }

  return pages.join('\n\n[PAGE]\n\n');
}
