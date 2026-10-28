// FILE: src/myNotesStudio/fileIngestor.js
import { structureRawTextToSuru } from './noteFormatter';

export const SUPPORTED_EXTENSIONS =
  '.pdf,.docx,.epub,.txt,.md,.markdown,.csv,.json,.html,.htm';

async function loadPdfJs() {
  const pdfjs = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.2.67/build/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc =
    'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.2.67/build/pdf.worker.min.mjs';
  return pdfjs;
}

async function loadMammoth() {
  const mammoth = await import('https://cdn.jsdelivr.net/npm/mammoth@1.8.0/+esm');
  return mammoth.default || mammoth;
}

async function loadJSZip() {
  const jszip = await import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm');
  return jszip.default || jszip;
}

export async function extractTextFromFile(file, onProgress) {
  const name = file.name || 'Document';
  const ext = name.split('.').pop().toLowerCase();

  if (['txt', 'md', 'markdown'].includes(ext)) {
    onProgress && onProgress('Reading text...');
    return await file.text();
  }

  if (['html', 'htm'].includes(ext)) {
    const rawHtml = await file.text();
    const doc = new DOMParser().parseFromString(rawHtml, 'text/html');
    return doc.body?.innerText || rawHtml;
  }

  if (ext === 'csv') {
    const rawCsv = await file.text();
    const rows = rawCsv.split(/\r?\n/).filter(Boolean);
    const headers = rows[0]?.split(',') || [];
    return rows
      .slice(1)
      .map((r, i) => {
        const cols = r.split(',');
        const pairs = cols.map((c, idx) => `**${headers[idx] || `Field ${idx + 1}`}**: ${c.trim()}`);
        return `## Item ${i + 1}\n\n${pairs.join('\n')}`;
      })
      .join('\n\n');
  }

  if (ext === 'json') {
    const rawJson = await file.text();
    try {
      const obj = JSON.parse(rawJson);
      return typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2);
    } catch {
      return rawJson;
    }
  }

  if (ext === 'docx') {
    onProgress && onProgress('Reading Word document...');
    const mammoth = await loadMammoth();
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value || '';
  }

  // PDF: Strip running page headers/footers that repeat across pages
  if (ext === 'pdf') {
    onProgress && onProgress('Opening PDF...');
    const pdfjs = await loadPdfJs();
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    const rawPages = [];
    const firstLineFreq = {};

    for (let i = 1; i <= pdf.numPages; i++) {
      if (i % 5 === 1 || i === pdf.numPages) {
        onProgress && onProgress(`Scanning page ${i} / ${pdf.numPages}...`);
      }
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();

      let lastY = null;
      let lines = [];
      let currentLine = [];

      for (const item of content.items) {
        const y = Math.round(item.transform?.[5] || 0);
        if (lastY !== null && Math.abs(y - lastY) > 6) {
          lines.push(currentLine.join(' ').trim());
          currentLine = [];
          if (Math.abs(y - lastY) > 16) lines.push('');
        }
        currentLine.push(item.str);
        lastY = y;
      }
      if (currentLine.length > 0) lines.push(currentLine.join(' ').trim());

      // Remove standalone page numbers
      const cleanLines = lines.filter((l) => !/^\d{1,4}$/.test(l));
      const topNonEmpty = cleanLines.find((l) => l.length > 0);
      if (topNonEmpty) {
        const key = topNonEmpty.toLowerCase();
        firstLineFreq[key] = (firstLineFreq[key] || 0) + 1;
      }
      rawPages.push(cleanLines);
    }

    // Any top line that repeats on 3+ pages is a running header (like "Chapter One: Lesson 1") -> strip it after its first appearance!
    const seenRunningHeaders = new Set();
    const pageTexts = rawPages.map((lines) => {
      const idx = lines.findIndex((l) => l.length > 0);
      if (idx !== -1) {
        const key = lines[idx].toLowerCase();
        if (firstLineFreq[key] >= 3) {
          if (seenRunningHeaders.has(key)) {
            lines.splice(idx, 1);
          } else {
            seenRunningHeaders.add(key);
          }
        }
      }
      return lines.join('\n');
    });

    return pageTexts.join('\n\n');
  }

  if (ext === 'epub') {
    onProgress && onProgress('Unpacking eBook chapters...');
    const JSZip = await loadJSZip();
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const htmlFiles = Object.keys(zip.files)
      .filter((path) => /\.(xhtml|html|htm)$/i.test(path))
      .sort();

    const chapters = [];
    for (let i = 0; i < htmlFiles.length; i++) {
      const rawXhtml = await zip.files[htmlFiles[i]].async('string');
      const doc = new DOMParser().parseFromString(rawXhtml, 'text/html');
      const heading =
        doc.querySelector('h1, h2, h3, title')?.textContent?.trim() || `Chapter ${i + 1}`;
      const bodyText = doc.body?.innerText?.trim() || '';
      if (bodyText.length > 100) {
        chapters.push(`CHAPTER_SPLIT_MARKER: ${heading}\n\n${bodyText}`);
      }
    }
    return chapters.join('\n\n');
  }

  return await file.text();
}

/**
 * Extracts a canonical chapter key (e.g. "chapter 1" or "lesson 2") so if a heading repeats,
 * we merge it into the same chapter instead of making 15 duplicate "Chapter One" items!
 */
function getCanonicalChapterKey(heading = '') {
  const clean = heading.toLowerCase().replace(/\s+/g, ' ').trim();
  const match = clean.match(
    /\b(chapter|lesson|part|unit|module|rule|secret)\s+(\d+|[ivxlc]+|one|two|three|four|five|six|seven|eight|nine|ten)\b/i
  );
  if (match) return `${match[1].toLowerCase()}_${match[2].toLowerCase()}`;
  return clean.slice(0, 28);
}

function predictSmartHeadingAndTeaser(chunkBody, rawHeading, index, total) {
  const lines = chunkBody
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  let bestTitle = rawHeading ? rawHeading.replace(/\s+/g, ' ').trim() : '';
  const isGeneric =
    !bestTitle ||
    /^(?:Chapter|Lesson|Part|Unit|Section)\s+(?:\d+|[IVXLC]+|One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten)(?:\s*:\s*Lesson\s+\d+)?$/i.test(
      bestTitle
    );

  // Look at the first 5 lines of the chapter for the real descriptive title (e.g. "The Rich Don't Work for Money")
  if (isGeneric && lines.length > 0) {
    const subtitleCandidate = lines.slice(0, 5).find(
      (l) =>
        l.length >= 6 &&
        l.length <= 65 &&
        !/[.!?]$/.test(l) &&
        l.toLowerCase() !== bestTitle.toLowerCase() &&
        !/^(?:page|\d+|copyright)/i.test(l)
    );
    if (subtitleCandidate) {
      const cleanSub = subtitleCandidate.replace(/^#+\s*/, '');
      bestTitle = bestTitle ? `${bestTitle} — ${cleanSub}` : cleanSub;
    }
  }

  if (!bestTitle && lines.length > 0) {
    const firstSentence = lines.join(' ').split(/[.!?]/)[0] || '';
    const words = firstSentence.trim().split(/\s+/).slice(0, 7).join(' ');
    bestTitle = words.length > 4 ? `${words}...` : `Chapter ${index + 1}`;
  }

  const bodyPreviewLine =
    lines.find((l) => l.length > 45 && !bestTitle.includes(l) && !l.startsWith('#')) ||
    lines[1] ||
    lines[0] ||
    '';
  const cleanPreview = bodyPreviewLine.replace(/^#+\s*/, '').slice(0, 75);
  const wordCount = chunkBody.split(/\s+/).length;
  const estPages = Math.max(1, Math.round(wordCount / 220));

  return {
    title: bestTitle.slice(0, 68),
    subtitle: `${estPages} Pages • ${cleanPreview}${bodyPreviewLine.length > 75 ? '…' : ''}`
  };
}

export function chunkDocumentIntoChapters(fullText, fileName = 'Book') {
  const cleanBookName = fileName
    .replace(/\.[^/.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b(?:ebook|pdf|docx|epub|free|download)\b/gi, '')
    .trim();

  const normalized = fullText.replace(/\r\n/g, '\n').trim();

  const chapterRegex =
    /(?:^|\n\n)(?:CHAPTER_SPLIT_MARKER:\s*([^\n]+)|#{1,2}\s+([^\n]{4,70})|((?:CHAPTER|Chapter|LESSON|Lesson|PART|Part|UNIT|Unit|MODULE|Module)\s+(?:\d+|[IVXLC]+|One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten)(?:\s*[:.—-]\s*[^\n]{2,70})?(?:\n+[A-Z][^\n.!?]{3,65})?))\s*\n/g;

  const matches = [...normalized.matchAll(chapterRegex)];
  const rawChunks = [];

  if (matches.length >= 2) {
    if (matches[0].index > 500) {
      rawChunks.push({
        rawHeading: 'Introduction & Preface',
        body: normalized.slice(0, matches[0].index).trim()
      });
    }

    for (let i = 0; i < matches.length; i++) {
      const startIdx = matches[i].index + matches[i][0].length;
      const endIdx = i + 1 < matches.length ? matches[i + 1].index : normalized.length;
      const heading = (matches[i][1] || matches[i][2] || matches[i][3] || '')
        .replace(/\n+/g, ' — ')
        .trim();
      const body = normalized.slice(startIdx, endIdx).trim();

      if (body.length < 150) continue; // Ignore Table of Contents lines

      // DEDUPLICATE RUNNING HEADERS: If this chunk has the same Chapter/Lesson key as the previous one, merge them!
      const prevChunk = rawChunks[rawChunks.length - 1];
      if (
        prevChunk &&
        getCanonicalChapterKey(prevChunk.rawHeading) === getCanonicalChapterKey(heading)
      ) {
        prevChunk.body += '\n\n' + body;
      } else {
        rawChunks.push({ rawHeading: heading, body });
      }
    }
  }

  // Fallback for books without Chapter labels: group into substantial ~3,500-word chapters
  if (rawChunks.length === 0) {
    const paragraphs = normalized.split(/\n\s*\n/).filter(Boolean);
    const TARGET_WORDS = 3500;
    let currentParas = [];
    let wordCount = 0;

    for (const p of paragraphs) {
      const pWords = p.split(/\s+/).length;
      if (wordCount + pWords > TARGET_WORDS && currentParas.length > 0) {
        rawChunks.push({ rawHeading: '', body: currentParas.join('\n\n') });
        currentParas = [p];
        wordCount = pWords;
      } else {
        currentParas.push(p);
        wordCount += pWords;
      }
    }
    if (currentParas.length > 0) {
      rawChunks.push({ rawHeading: '', body: currentParas.join('\n\n') });
    }
  }

  const total = rawChunks.length;
  const topics = rawChunks.map((ch, idx) => {
    const meta = predictSmartHeadingAndTeaser(ch.body, ch.rawHeading, idx, total);
    const structured = structureRawTextToSuru(ch.body, meta.title);
    return {
      id: `file_ch_${Date.now()}_${idx}`,
      title: meta.title,
      subtitle: meta.subtitle,
      text: structured.text,
      glossary: structured.glossary
    };
  });

  return {
    id: `deck_file_${Date.now()}`,
    title: (cleanBookName || 'IMPORTED BOOK').toUpperCase(),
    subtitle: `${topics.length} Chapters`,
    badge: `${topics.length} CH`,
    createdAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    sourceType: 'FILE',
    topics
  };
}
