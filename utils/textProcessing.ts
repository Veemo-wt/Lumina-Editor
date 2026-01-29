import { ChunkData, GlossaryItem, CharacterTrait, RawFile, RagEntry } from '../types';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import JSZip from 'jszip';

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs';

/**
 * Split text into sentences with better handling of abbreviations and edge cases
 */
export const splitIntoSentences = (text: string): string[] => {
  // Common abbreviations that shouldn't end a sentence
  const abbreviations = ['Mr', 'Mrs', 'Ms', 'Dr', 'Prof', 'Sr', 'Jr', 'vs', 'etc', 'i.e', 'e.g', 'np', 'tzn', 'tzw', 'ok', 'al', 'ul', 'pl', 'wg', 'mgr', 'inż', 'dr', 'hab', 'prof'];

  // Replace abbreviations temporarily
  let processed = text;
  abbreviations.forEach((abbr, idx) => {
    const regex = new RegExp(`\\b${abbr}\\.`, 'gi');
    processed = processed.replace(regex, `{{ABBR_${idx}}}`);
  });

  // Split on sentence-ending punctuation followed by space and capital letter or end of string
  // Handles: . ! ? and their combinations with quotes
  const sentenceRegex = /([.!?]+["'"']?\s+)(?=[A-ZĄĆĘŁŃÓŚŹŻ])|([.!?]+["'"']?)$/g;

  const sentences: string[] = [];
  let lastIndex = 0;
  let match;

  while ((match = sentenceRegex.exec(processed)) !== null) {
    const sentence = processed.slice(lastIndex, match.index + match[0].length).trim();
    if (sentence) {
      // Restore abbreviations
      let restored = sentence;
      abbreviations.forEach((abbr, idx) => {
        restored = restored.replace(new RegExp(`\\{\\{ABBR_${idx}\\}\\}`, 'g'), `${abbr}.`);
      });
      sentences.push(restored);
    }
    lastIndex = match.index + match[0].length;
  }

  // Handle remaining text
  if (lastIndex < processed.length) {
    let remaining = processed.slice(lastIndex).trim();
    if (remaining) {
      abbreviations.forEach((abbr, idx) => {
        remaining = remaining.replace(new RegExp(`\\{\\{ABBR_${idx}\\}\\}`, 'g'), `${abbr}.`);
      });
      sentences.push(remaining);
    }
  }

  return sentences.filter(s => s.length > 0);
};

/**
 * Align source and target sentences using length-ratio heuristics
 * Returns pairs of aligned sentences
 */
export const alignSentences = (
  sourceSentences: string[],
  targetSentences: string[]
): Array<{ source: string; target: string }> => {
  const aligned: Array<{ source: string; target: string }> = [];

  // If counts match exactly, assume 1:1 alignment
  if (sourceSentences.length === targetSentences.length) {
    for (let i = 0; i < sourceSentences.length; i++) {
      aligned.push({
        source: sourceSentences[i],
        target: targetSentences[i]
      });
    }
    return aligned;
  }

  // Polish text is typically 15-25% longer than English
  // Use dynamic programming approach for better alignment
  const POLISH_EXPANSION_RATIO = 1.20; // Expected Polish/English ratio
  const TOLERANCE = 0.4; // 40% tolerance

  let srcIdx = 0;
  let tgtIdx = 0;

  while (srcIdx < sourceSentences.length && tgtIdx < targetSentences.length) {
    const srcSentence = sourceSentences[srcIdx];
    const tgtSentence = targetSentences[tgtIdx];

    // Calculate expected target length
    const expectedTgtLen = srcSentence.length * POLISH_EXPANSION_RATIO;
    const actualTgtLen = tgtSentence.length;

    // Check if lengths are within tolerance for 1:1 alignment
    const ratio = actualTgtLen / expectedTgtLen;

    if (ratio >= (1 - TOLERANCE) && ratio <= (1 + TOLERANCE)) {
      // Good 1:1 match
      aligned.push({ source: srcSentence, target: tgtSentence });
      srcIdx++;
      tgtIdx++;
    } else if (ratio < (1 - TOLERANCE) && tgtIdx + 1 < targetSentences.length) {
      // Target too short - might need to merge target sentences (1:2)
      const mergedTarget = tgtSentence + ' ' + targetSentences[tgtIdx + 1];
      const mergedRatio = mergedTarget.length / expectedTgtLen;

      if (Math.abs(mergedRatio - 1) < Math.abs(ratio - 1)) {
        aligned.push({ source: srcSentence, target: mergedTarget });
        srcIdx++;
        tgtIdx += 2;
      } else {
        aligned.push({ source: srcSentence, target: tgtSentence });
        srcIdx++;
        tgtIdx++;
      }
    } else if (ratio > (1 + TOLERANCE) && srcIdx + 1 < sourceSentences.length) {
      // Target too long - might need to merge source sentences (2:1)
      const mergedSource = srcSentence + ' ' + sourceSentences[srcIdx + 1];
      const mergedExpected = mergedSource.length * POLISH_EXPANSION_RATIO;
      const mergedRatio = actualTgtLen / mergedExpected;

      if (Math.abs(mergedRatio - 1) < Math.abs(ratio - 1)) {
        aligned.push({ source: mergedSource, target: tgtSentence });
        srcIdx += 2;
        tgtIdx++;
      } else {
        aligned.push({ source: srcSentence, target: tgtSentence });
        srcIdx++;
        tgtIdx++;
      }
    } else {
      // Fallback: just pair them
      aligned.push({ source: srcSentence, target: tgtSentence });
      srcIdx++;
      tgtIdx++;
    }
  }

  // Handle remaining sentences
  while (srcIdx < sourceSentences.length && tgtIdx < targetSentences.length) {
    aligned.push({
      source: sourceSentences[srcIdx],
      target: targetSentences[tgtIdx]
    });
    srcIdx++;
    tgtIdx++;
  }

  // If there are leftover source sentences, pair with empty or merge
  if (srcIdx < sourceSentences.length && aligned.length > 0) {
    const remaining = sourceSentences.slice(srcIdx).join(' ');
    aligned[aligned.length - 1].source += ' ' + remaining;
  }

  // If there are leftover target sentences, merge with last
  if (tgtIdx < targetSentences.length && aligned.length > 0) {
    const remaining = targetSentences.slice(tgtIdx).join(' ');
    aligned[aligned.length - 1].target += ' ' + remaining;
  }

  return aligned;
};

/**
 * Create aligned sentence pairs from source and target text
 * Returns array of {source, target} pairs suitable for RAG
 */
export const createAlignedPairs = (
  sourceText: string,
  targetText: string,
  minSentenceLength: number = 20
): Array<{ source: string; target: string }> => {
  const sourceSentences = splitIntoSentences(sourceText).filter(s => s.length >= minSentenceLength);
  const targetSentences = splitIntoSentences(targetText).filter(s => s.length >= minSentenceLength);

  if (sourceSentences.length === 0 || targetSentences.length === 0) {
    // Fallback to full text
    return [{ source: sourceText, target: targetText }];
  }

  return alignSentences(sourceSentences, targetSentences);
};

export const createWorldPackage = async (
  glossary: GlossaryItem[],
  characterBible: CharacterTrait[],
  ragEntries: RagEntry[]
): Promise<Blob> => {
  const zip = new JSZip();

  // 1. Metadata JSON (Lightweight)
  const metadata = {
    version: "2.1",
    createdAt: new Date().toISOString(),
    project: "Lumina World Knowledge Pack",
    counts: {
      glossary: glossary.length,
      characterBible: characterBible.length,
      ragEntries: ragEntries.length
    }
  };
  zip.file("metadata.json", JSON.stringify(metadata, null, 2));

  // 2. Core Config Files (User Editable)
  zip.file("glossary.json", JSON.stringify(glossary, null, 2));
  zip.file("character_bible.json", JSON.stringify(characterBible, null, 2));

  // 3. RAG Database (Heavy)
  zip.file("rag_vector_store.json", JSON.stringify(ragEntries));

  return await zip.generateAsync({ type: "blob" });
};

export const parseWorldPackage = async (file: File): Promise<{
  glossary: GlossaryItem[];
  characterBible: CharacterTrait[];
  ragEntries: RagEntry[];
}> => {
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(file);

  let glossary: GlossaryItem[] = [];
  let characterBible: CharacterTrait[] = [];
  let ragEntries: RagEntry[] = [];

  // 1. Try Independent Files (New Format)
  if (loadedZip.file("glossary.json")) {
    const str = await loadedZip.file("glossary.json")?.async("string");
    if (str) glossary = JSON.parse(str);
  }

  if (loadedZip.file("character_bible.json")) {
    const str = await loadedZip.file("character_bible.json")?.async("string");
    if (str) characterBible = JSON.parse(str);
  }

  // 2. Fallback to Old Metadata (Backward Compatibility)
  if (glossary.length === 0 && characterBible.length === 0 && loadedZip.file("metadata.json")) {
    const metaStr = await loadedZip.file("metadata.json")?.async("string");
    if (metaStr) {
      const meta = JSON.parse(metaStr);
      // Only use if they exist in metadata (old format)
      if (meta.glossary) glossary = meta.glossary;
      if (meta.characterBible) characterBible = meta.characterBible;
    }
  }
  // 3. Legacy support for plain JSON exports
  else if (file.name.endsWith('.json') && !file.name.endsWith('metadata.json')) {
    const text = await file.text();
    const json = JSON.parse(text);
    return {
      glossary: json.glossary || [],
      characterBible: json.characterBible || [],
      ragEntries: []
    };
  }

  // 4. Parse RAG Store
  if (loadedZip.file("rag_vector_store.json")) {
    const ragStr = await loadedZip.file("rag_vector_store.json")?.async("string");
    if (ragStr) {
      ragEntries = JSON.parse(ragStr);
    }
  }

  return { glossary, characterBible, ragEntries };
};

/**
 * Robust length-based splitter.
 * Handles cases where a single line might exceed targetSize (e.g. bad PDF extraction).
 */
const chunkByLength = (text: string, targetSize: number): string[] => {
  const chunks: string[] = [];

  // 1. Split by newlines first to preserve paragraphs
  const lines = text.split('\n');

  let currentChunkText = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if the line itself is massive (larger than chunk size)
    if (line.length > targetSize) {
      // If we have accumulation, push it first
      if (currentChunkText.length > 0) {
        chunks.push(currentChunkText);
        currentChunkText = '';
      }

      // Split massive line by sentences (heuristic)
      const sentences = line.match(/[^.!?]+[.!?]+["']?|[^.!?]+$/g) || [line];

      let tempMassiveChunk = '';
      for (const sentence of sentences) {
        if ((tempMassiveChunk.length + sentence.length) > targetSize) {
          if (tempMassiveChunk.length > 0) {
            chunks.push(tempMassiveChunk);
            tempMassiveChunk = '';
          }
          // If a single sentence is still huge (rare but possible), hard split
          if (sentence.length > targetSize) {
            const hardSplits = sentence.match(new RegExp(`.{1,${targetSize}}`, 'g')) || [sentence];
            hardSplits.forEach(s => chunks.push(s));
            continue;
          }
        }
        tempMassiveChunk += sentence;
      }
      if (tempMassiveChunk.length > 0) {
        // Don't push immediately, maybe we can fit more from next lines? 
        // Actually for massive line handling, safer to push and reset.
        chunks.push(tempMassiveChunk);
      }
      // Add newline that was stripped by split
      if (chunks.length > 0) {
        chunks[chunks.length - 1] += '\n';
      }
      continue;
    }

    // Normal behavior for reasonable lines
    if ((currentChunkText.length + line.length) > targetSize && currentChunkText.length > 0) {
      chunks.push(currentChunkText);
      currentChunkText = '';
    }
    currentChunkText += line + '\n';
  }

  if (currentChunkText.length > 0) {
    chunks.push(currentChunkText);
  }

  return chunks;
};

/**
 * Main Chunking Function
 * 1. If pattern is provided, it attempts to split by "Chapter X" headers.
 * 2. It ensures strict start-of-line matching to avoid false positives in text.
 * 3. If a semantic chunk is still larger than targetSize, it recursively sub-chunks it by length.
 */
export const chunkText = (
  text: string,
  targetSize: number,
  chapterPattern?: string
): Omit<ChunkData, 'id'>[] => {

  // If no pattern, just use length chunking
  if (!chapterPattern || !chapterPattern.trim()) {
    const rawChunks = chunkByLength(text, targetSize);
    return rawChunks.map(c => ({
      originalText: c,
      correctedText: null,
      mistakes: [],
      status: 'pending' as const
    }));
  }

  // SEMANTIC CHUNKING LOGIC
  const chunks: Omit<ChunkData, 'id'>[] = [];

  try {
    // Construct Regex with Multiline flag (m) to match start of lines (^).
    // We strictly look for the pattern at the beginning of a line.
    // We use a capturing group () around the pattern to keep the header in the split result.
    const regex = new RegExp(`^(${chapterPattern}.*)`, 'gmi');

    // Split: [Intro, Header1, Body1, Header2, Body2...]
    const parts = text.split(regex);

    // If split failed (length 1), regex didn't match anything. Fallback.
    if (parts.length < 2) {
      const rawChunks = chunkByLength(text, targetSize);
      return rawChunks.map(c => ({
        originalText: c,
        correctedText: null,
        mistakes: [],
        status: 'pending' as const,
        sourceFileName: 'Auto-Split'
      }));
    }

    let currentSectionTitle = "Intro / Prologue";
    let buffer = "";

    // Iterate through parts. 
    // parts[0] is usually text before first chapter (intro).
    // Then it alternates: Header, Body, Header, Body.
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!part) continue;

      // Check if this part matches our header pattern
      // We re-check via regex to see if this string *is* the header
      // (Since split puts delimiters in the array)
      const isHeader = new RegExp(`^${chapterPattern}`, 'mi').test(part);

      if (isHeader) {
        // If we have a buffer accumulated (the previous chapter body), push it
        if (buffer.trim().length > 0) {
          processSection(buffer, currentSectionTitle, targetSize, chunks);
        }
        // Start new section
        currentSectionTitle = part.trim().substring(0, 50); // specific chapter name
        buffer = part; // Add header to the start of the new buffer
      } else {
        // It's body text, append to buffer
        buffer += part;
      }
    }

    // Push the final buffer
    if (buffer.trim().length > 0) {
      processSection(buffer, currentSectionTitle, targetSize, chunks);
    }

  } catch (e) {
    console.warn("Regex chunking failed, reverting to length", e);
    const rawChunks = chunkByLength(text, targetSize);
    return rawChunks.map(c => ({
      originalText: c,
      correctedText: null,
      mistakes: [],
      status: 'pending' as const
    }));
  }

  return chunks;
};

/**
 * Helper to process a single semantic section.
 * Checks if the section fits within targetSize. 
 * If yes -> 1 chunk.
 * If no -> sub-chunk by length.
 */
const processSection = (
  text: string,
  title: string,
  limit: number,
  outputArray: Omit<ChunkData, 'id'>[]
) => {
  if (text.length <= limit * 1.2) {
    // Allow 20% overflow for semantic integrity (better to keep chapter together if close)
    outputArray.push({
      originalText: text,
      correctedText: null,
      mistakes: [],
      status: 'pending',
      sourceFileName: title
    });
  } else {
    // Too big, split it up
    const subChunks = chunkByLength(text, limit);
    subChunks.forEach((sc, idx) => {
      outputArray.push({
        originalText: sc,
        correctedText: null,
        mistakes: [],
        status: 'pending',
        sourceFileName: `${title} (Part ${idx + 1})`
      });
    });
  }
};

/**
 * Extracts the last N characters from a text to serve as lookback context.
 */
export const getLookback = (text: string, size: number): string => {
  if (text.length <= size) return text;
  return text.slice(-size);
};

export const calculateReadingTime = (text: string): number => {
  const wordsPerMinute = 200;
  const words = text.trim().split(/\s+/).length;
  return Math.ceil(words / wordsPerMinute);
};

export const downloadFile = (filename: string, content: string) => {
  const element = document.createElement('a');
  const file = new Blob([content], { type: 'text/plain' });
  element.href = URL.createObjectURL(file);
  element.download = filename;
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
};

export const saveBlob = (filename: string, blob: Blob) => {
  const element = document.createElement('a');
  element.href = URL.createObjectURL(blob);
  element.download = filename;
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
};

export const mergeGlossaryItems = (existing: GlossaryItem[], newItems: GlossaryItem[]): GlossaryItem[] => {
  const existingTerms = new Set(existing.map(i => i.term.toLowerCase()));
  const uniqueNewItems = newItems.filter(i => !existingTerms.has(i.term.toLowerCase()));
  return [...existing, ...uniqueNewItems];
};

export const mergeCharacterTraits = (existing: CharacterTrait[], newItems: CharacterTrait[]): CharacterTrait[] => {
  const existingNames = new Set(existing.map(i => i.name.toLowerCase()));
  const uniqueNewItems = newItems.filter(i => !existingNames.has(i.name.toLowerCase()));
  return [...existing, ...uniqueNewItems];
};

/**
 * Basic whitespace cleanup - preserves paragraph structure
 * Used for DOCX and TXT where single newlines are intentional paragraph breaks
 */
export const cleanupWhitespaceBasic = (text: string): string => {
  return text
    // Normalize line endings
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Remove trailing/leading spaces on lines
    .replace(/ +$/gm, '')
    .replace(/^ +/gm, '')
    // Multiple spaces to single
    .replace(/ {2,}/g, ' ')
    // Multiple newlines (3+) to double newline
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

/**
 * Aggressive whitespace cleanup for PDF
 * Joins single newlines (soft wraps) into spaces
 * Only double newlines are preserved as paragraph breaks
 */
const cleanupWhitespacePdf = (text: string): string => {
  // Step 1: Normalize line endings
  let result = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  // Step 2: Normalize multiple spaces to single space
  result = result.replace(/ {2,}/g, ' ');

  // Step 3: Trim each line
  result = result.split('\n').map(line => line.trim()).join('\n');

  // Step 4: Mark real paragraph breaks (2+ newlines) with placeholder
  result = result.replace(/\n{2,}/g, '<<<PARA>>>');

  // Step 5: Replace ALL remaining single newlines with spaces
  // This joins soft-wrapped lines from PDF
  result = result.replace(/\n/g, ' ');

  // Step 6: Restore paragraph breaks
  result = result.replace(/<<<PARA>>>/g, '\n\n');

  // Step 7: Final cleanup
  result = result
    .replace(/ {2,}/g, ' ')      // Multiple spaces to single
    .replace(/ *\n */g, '\n')    // Clean spaces around newlines
    .replace(/\n{3,}/g, '\n\n')  // Max 2 consecutive newlines
    .trim();

  return result;
};

/**
 * Helper to process ArrayBuffer for PDF
 * Extracts text and joins with appropriate spacing
 * Optionally removes running heads (headers/footers)
 */
const parsePdfBuffer = async (buffer: ArrayBuffer, removeRunningHeads: boolean = true): Promise<string> => {
  const loadingTask = pdfjsLib.getDocument({ data: buffer });
  const pdf = await loadingTask.promise;

  // First pass: collect text positions to detect running heads
  const pageTexts: Array<{
    pageNum: number;
    items: Array<{ str: string; y: number; x: number; height: number }>;
    height: number;
  }> = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent();

    const items: Array<{ str: string; y: number; x: number; height: number }> = [];
    for (const item of textContent.items as any[]) {
      if (!item.str || !item.str.trim()) continue;
      items.push({
        str: item.str,
        y: item.transform?.[5] || 0,
        x: item.transform?.[4] || 0,
        height: item.height || 12
      });
    }

    pageTexts.push({
      pageNum: i,
      items,
      height: viewport.height
    });
  }

  // Detect running heads (text that appears at same position on multiple pages)
  const runningHeadTexts = new Set<string>();

  if (removeRunningHeads && pdf.numPages > 2) {
    // Group texts by approximate Y position (top 10% and bottom 10% of page)
    const headerTexts = new Map<string, number>(); // text -> count
    const footerTexts = new Map<string, number>();

    for (const page of pageTexts) {
      const topThreshold = page.height * 0.90; // top 10%
      const bottomThreshold = page.height * 0.10; // bottom 10%

      for (const item of page.items) {
        const normalizedText = item.str.trim().toLowerCase();
        if (normalizedText.length < 2) continue;

        if (item.y > topThreshold) {
          headerTexts.set(normalizedText, (headerTexts.get(normalizedText) || 0) + 1);
        } else if (item.y < bottomThreshold) {
          footerTexts.set(normalizedText, (footerTexts.get(normalizedText) || 0) + 1);
        }
      }
    }

    // If text appears on more than 30% of pages at header/footer position, it's a running head
    const threshold = Math.max(2, Math.floor(pdf.numPages * 0.3));

    for (const [text, count] of headerTexts) {
      if (count >= threshold) {
        runningHeadTexts.add(text);
      }
    }
    for (const [text, count] of footerTexts) {
      if (count >= threshold) {
        runningHeadTexts.add(text);
      }
    }

    // Also detect common running head patterns
    const runningHeadPatterns = [
      /^\d+$/, // Just page number
      /^[IVXLCDM]+$/i, // Roman numerals
      /^rozdział\s+[\dIVXLCDM]+$/i,
      /^chapter\s+[\dIVXLCDM]+$/i,
      /^część\s+[\dIVXLCDM]+$/i,
    ];

    for (const page of pageTexts) {
      const topThreshold = page.height * 0.90;
      const bottomThreshold = page.height * 0.10;

      for (const item of page.items) {
        if (item.y > topThreshold || item.y < bottomThreshold) {
          const trimmed = item.str.trim();
          for (const pattern of runningHeadPatterns) {
            if (pattern.test(trimmed)) {
              runningHeadTexts.add(trimmed.toLowerCase());
              break;
            }
          }
        }
      }
    }
  }

  // Second pass: extract text excluding running heads
  let fullText = '';

  for (const page of pageTexts) {
    const topThreshold = page.height * 0.90;
    const bottomThreshold = page.height * 0.10;

    // Filter items
    const filteredItems = page.items.filter(item => {
      if (removeRunningHeads) {
        // Skip if in header/footer zone and matches running head
        if (item.y > topThreshold || item.y < bottomThreshold) {
          if (runningHeadTexts.has(item.str.trim().toLowerCase())) {
            return false;
          }
        }
      }
      return true;
    });

    // Sort by Y (descending) then X (ascending)
    filteredItems.sort((a, b) => {
      const yDiff = b.y - a.y;
      if (Math.abs(yDiff) > 5) return yDiff;
      return a.x - b.x;
    });

    let lastY: number | null = null;
    let pageText = '';

    for (const item of filteredItems) {
      const currentY = item.y;

      if (lastY !== null) {
        const yDiff = Math.abs(lastY - currentY);

        if (yDiff > 25) {
          pageText += '\n\n';
        } else if (yDiff > 1) {
          if (!pageText.endsWith(' ') && !pageText.endsWith('\n')) {
            pageText += ' ';
          }
        } else if (!pageText.endsWith(' ') && !pageText.endsWith('\n') && item.str.trim()) {
          pageText += ' ';
        }
      }

      pageText += item.str;
      lastY = currentY;
    }

    fullText += pageText + '\n\n';
  }

  return cleanupWhitespacePdf(fullText);
};

/**
 * Parse IDML file (InDesign Markup Language)
 * IDML is a ZIP archive containing XML files
 */
const parseIdmlBuffer = async (buffer: ArrayBuffer): Promise<string> => {
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(buffer);

  const textParts: string[] = [];

  // IDML structure: Stories folder contains the actual text content
  const storyFiles = Object.keys(loadedZip.files)
    .filter(name => name.startsWith('Stories/') && name.endsWith('.xml'))
    .sort();

  for (const storyFile of storyFiles) {
    const xmlContent = await loadedZip.files[storyFile].async('string');
    const extractedText = extractTextFromIdmlStory(xmlContent);
    if (extractedText.trim()) {
      textParts.push(extractedText);
    }
  }

  return textParts.join('\n\n');
};

/**
 * Extract text from IDML Story XML
 */
const extractTextFromIdmlStory = (xmlContent: string): string => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlContent, 'text/xml');

  const textParts: string[] = [];

  // Process ParagraphStyleRange elements to maintain paragraph structure
  const paragraphs = doc.querySelectorAll('ParagraphStyleRange');

  for (const para of paragraphs) {
    let paraText = '';

    // Get all Content elements within this paragraph
    const contents = para.querySelectorAll('Content');
    for (const content of contents) {
      paraText += content.textContent || '';
    }

    // Check for Br (break) elements
    const hasBr = para.querySelector('Br') !== null;

    const cleaned = cleanIdmlText(paraText);
    if (cleaned.trim()) {
      textParts.push(cleaned);
    } else if (hasBr || paraText.includes(String.fromCharCode(0x0003))) {
      // Empty paragraph with break = paragraph separator
      textParts.push('');
    }
  }

  // Fallback: if no paragraphs found, try Content elements directly
  if (textParts.length === 0) {
    const contents = doc.querySelectorAll('Content');
    for (const content of contents) {
      const text = cleanIdmlText(content.textContent || '');
      if (text.trim()) {
        textParts.push(text);
      }
    }
  }

  // Join with double newline for proper paragraph separation
  return textParts
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

/**
 * Clean InDesign special characters from text
 */
const cleanIdmlText = (text: string): string => {
  return text
    // Remove InDesign special characters
    .replace(/\uFEFF/g, '') // BOM
    .replace(/\u2028/g, '\n') // Line separator
    .replace(/\u2029/g, '\n\n') // Paragraph separator
    .replace(/\u0003/g, '\n\n') // InDesign paragraph break
    .replace(/\u0004/g, '\n') // InDesign forced line break
    .replace(/\u0005/g, '\n') // InDesign column break
    .replace(/\u0006/g, '\n\n') // InDesign frame break
    .replace(/\u0007/g, '\n\n') // InDesign page break
    .replace(/\u0008/g, '') // InDesign odd page break
    .replace(/\u0018/g, '\t') // InDesign right indent tab
    .replace(/\u0019/g, '') // InDesign indent to here
    .replace(/\u200B/g, '') // Zero-width space
    .replace(/\u200C/g, '') // Zero-width non-joiner
    .replace(/\u200D/g, '') // Zero-width joiner
    .replace(/\u00AD/g, '') // Soft hyphen (discretionary hyphen) - IMPORTANT!
    .replace(/\u2011/g, '-') // Non-breaking hyphen
    .replace(/\u2010/g, '-') // Hyphen
    .replace(/\uF8E8/g, '') // InDesign end nested style here
    .replace(/\uF702/g, '') // InDesign auto page number
    .replace(/\uF703/g, '') // InDesign section marker
    // Remove hyphenation breaks (word-hyphen-newline patterns)
    .replace(/(\w)-\s*\n\s*(\w)/g, '$1$2') // Rejoin hyphenated words
    // Clean up multiple spaces/newlines
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

export const extractTextFromPdf = async (file: File, removeRunningHeads: boolean = true): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  return parsePdfBuffer(arrayBuffer, removeRunningHeads);
};

export const extractTextFromIdml = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  return parseIdmlBuffer(arrayBuffer);
};

/**
 * Helper to process ArrayBuffer for Docx
 * Preserves paragraph structure (single newlines are real paragraphs in DOCX)
 */
const parseDocxBuffer = async (buffer: ArrayBuffer): Promise<string> => {
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return cleanupWhitespaceBasic(result.value);
};

export const extractTextFromDocx = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  return parseDocxBuffer(arrayBuffer);
};

export const extractTextFromZip = async (file: File, removeRunningHeads: boolean = true): Promise<RawFile[]> => {
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(file);
  const files: RawFile[] = [];

  // Filter and sort files (alphanumeric sort to keep Chapter 1, 2, 10 in order)
  const filenames = Object.keys(loadedZip.files).sort((a, b) => {
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  });

  for (const filename of filenames) {
    const fileEntry = loadedZip.files[filename];
    if (fileEntry.dir) continue;
    if (filename.startsWith('__MACOSX')) continue;
    if (filename.split('/').pop()?.startsWith('.')) continue; // Hidden files

    const ext = filename.split('.').pop()?.toLowerCase();
    let text = '';

    try {
      if (ext === 'txt' || ext === 'md') {
        text = cleanupWhitespaceBasic(await fileEntry.async('string'));
      } else if (ext === 'docx') {
        const buffer = await fileEntry.async('arraybuffer');
        text = await parseDocxBuffer(buffer);
      } else if (ext === 'pdf') {
        const buffer = await fileEntry.async('arraybuffer');
        text = await parsePdfBuffer(buffer, removeRunningHeads);
      } else if (ext === 'idml') {
        const buffer = await fileEntry.async('arraybuffer');
        text = await parseIdmlBuffer(buffer);
      }
    } catch (e) {
      console.warn(`Failed to extract ${filename}`, e);
      // We skip files we can't read
    }

    if (text.trim()) {
      files.push({ name: filename, content: text });
    }
  }

  return files;
};

export const generateDocxBlob = async (text: string): Promise<Blob> => {
  const paragraphs = text.split('\n').map(line =>
    new Paragraph({
      children: [new TextRun(line)],
      spacing: { after: 120 }
    })
  );

  const doc = new Document({
    sections: [{
      properties: {},
      children: paragraphs,
    }],
  });

  return await Packer.toBlob(doc);
};

/**
 * Local formatting error detection - no AI needed
 * Detects: double spaces, spaces before punctuation, Polish punctuation rules, etc.
 */
export interface LocalMistake {
  originalText: string;
  suggestedFix: string;
  reason: string;
  category: 'formatting';
  position: { start: number; end: number };
}

/**
 * Detect InDesign-style word breaks (e.g., "ewen - tualnie" or "ewen- tualnie")
 * Returns positions of such breaks to exclude from formatting errors
 */
const detectInDesignWordBreaks = (text: string): Array<{ start: number; end: number }> => {
  const breaks: Array<{ start: number; end: number }> = [];

  // Pattern for InDesign word breaks: lowercase letter, optional space, hyphen, optional space, lowercase letter
  // e.g., "ewen - tualnie", "ewen- tualnie", "ewen -tualnie"
  const indesignBreakRegex = /[a-ząćęłńóśźż]\s*-\s*[a-ząćęłńóśźż]/gi;

  let match;
  while ((match = indesignBreakRegex.exec(text)) !== null) {
    // Expand the range to include surrounding context
    breaks.push({
      start: match.index,
      end: match.index + match[0].length
    });
  }

  return breaks;
};

export const detectFormattingErrors = (text: string, indesignImport: boolean = false): LocalMistake[] => {
  const mistakes: LocalMistake[] = [];

  // Detect InDesign word breaks if option is enabled
  const indesignBreaks = indesignImport ? detectInDesignWordBreaks(text) : [];

  // Helper to check if a position is within an InDesign break
  const isInDesignBreak = (start: number, end: number): boolean => {
    return indesignBreaks.some(br =>
      (start >= br.start && start < br.end) ||
      (end > br.start && end <= br.end) ||
      (start <= br.start && end >= br.end)
    );
  };

  // Pattern definitions: [regex, reason, fix function]
  const patterns: Array<{
    regex: RegExp;
    reason: string;
    fix: (match: string) => string;
  }> = [
    // ===== SPACING ERRORS =====

    // Double (or more) spaces
    {
      regex: / {2,}/g,
      reason: 'Podwójna spacja',
      fix: () => ' '
    },
    // Space before comma
    {
      regex: / +,/g,
      reason: 'Spacja przed przecinkiem',
      fix: () => ','
    },
    // Space before period (but not after abbreviation like "np .")
    {
      regex: /(?<![a-z]{1,3}) +\./g,
      reason: 'Spacja przed kropką',
      fix: () => '.'
    },
    // Space before exclamation mark
    {
      regex: / +!/g,
      reason: 'Spacja przed wykrzyknikiem',
      fix: () => '!'
    },
    // Space before question mark
    {
      regex: / +\?/g,
      reason: 'Spacja przed znakiem zapytania',
      fix: () => '?'
    },
    // Space before colon (but allow time format like "10 : 30")
    {
      regex: /(?<!\d) +:/g,
      reason: 'Spacja przed dwukropkiem',
      fix: () => ':'
    },
    // Space before semicolon
    {
      regex: / +;/g,
      reason: 'Spacja przed średnikiem',
      fix: () => ';'
    },
    // Space before closing parenthesis
    {
      regex: / +\)/g,
      reason: 'Spacja przed nawiasem zamykającym',
      fix: () => ')'
    },
    // Space after opening parenthesis
    {
      regex: /\( +/g,
      reason: 'Spacja po nawiasie otwierającym',
      fix: () => '('
    },
    // Multiple consecutive newlines (more than 2)
    {
      regex: /\n{3,}/g,
      reason: 'Zbyt wiele pustych linii',
      fix: () => '\n\n'
    },

    // ===== MISSING SPACES =====

    // No space after comma (followed by letter, not quote or newline)
    {
      regex: /,([a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ])/g,
      reason: 'Brak spacji po przecinku',
      fix: (m) => ', ' + m.slice(1)
    },
    // No space after period (followed by capital letter - new sentence)
    {
      regex: /\.([A-ZĄĆĘŁŃÓŚŹŻ])/g,
      reason: 'Brak spacji po kropce',
      fix: (m) => '. ' + m.slice(1)
    },
    // No space after exclamation mark (followed by capital)
    {
      regex: /!([A-ZĄĆĘŁŃÓŚŹŻ])/g,
      reason: 'Brak spacji po wykrzykniku',
      fix: (m) => '! ' + m.slice(1)
    },
    // No space after question mark (followed by capital)
    {
      regex: /\?([A-ZĄĆĘŁŃÓŚŹŻ])/g,
      reason: 'Brak spacji po znaku zapytania',
      fix: (m) => '? ' + m.slice(1)
    },
    // No space after colon (followed by letter, not in time format)
    {
      regex: /:([a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ])/g,
      reason: 'Brak spacji po dwukropku',
      fix: (m) => ': ' + m.slice(1)
    },
    // No space after semicolon
    {
      regex: /;([a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ])/g,
      reason: 'Brak spacji po średniku',
      fix: (m) => '; ' + m.slice(1)
    },
    // No space after closing parenthesis (followed by letter)
    {
      regex: /\)([a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ])/g,
      reason: 'Brak spacji po nawiasie zamykającym',
      fix: (m) => ') ' + m.slice(1)
    },

    // ===== POLISH QUOTATION MARKS =====

    // English quotes at start -> Polish lower quote „
    {
      regex: /"([a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ])/g,
      reason: 'Angielski cudzysłów - użyj polskiego „',
      fix: (m) => '„' + m.slice(1)
    },
    // English quotes at end -> Polish upper quote "
    {
      regex: /([a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ.,!?])"/g,
      reason: 'Angielski cudzysłów - użyj polskiego "',
      fix: (m) => m.slice(0, -1) + '"'
    },
    // Space after opening Polish quote
    {
      regex: /„ +/g,
      reason: 'Spacja po cudzysłowie otwierającym',
      fix: () => '„'
    },
    // Space before closing Polish quote
    {
      regex: / +"/g,
      reason: 'Spacja przed cudzysłowiem zamykającym',
      fix: () => '"'
    },

    // ===== POLISH DIALOGUE DASHES =====

    // Hyphen used as dialogue dash at start of line -> em dash
    {
      regex: /^- (?=[A-ZĄĆĘŁŃÓŚŹŻa-ząćęłńóśźż])/gm,
      reason: 'Użyj półpauzy (–) zamiast łącznika (-) w dialogach',
      fix: () => '– '
    },
    // Hyphen after quote (dialogue attribution) -> em dash
    {
      regex: /" - /g,
      reason: 'Użyj półpauzy (–) zamiast łącznika (-)',
      fix: () => '" – '
    },
    // Missing space after dialogue dash
    {
      regex: /^–([A-ZĄĆĘŁŃÓŚŹŻa-ząćęłńóśźż])/gm,
      reason: 'Brak spacji po półpauzie w dialogu',
      fix: (m) => '– ' + m.slice(1)
    },

    // ===== ELLIPSIS =====

    // Three dots -> proper ellipsis character
    {
      regex: /\.{3}/g,
      reason: 'Użyj znaku wielokropka (…) zamiast trzech kropek',
      fix: () => '…'
    },
    // Space before ellipsis (usually incorrect in Polish)
    {
      regex: / +…/g,
      reason: 'Spacja przed wielokropkiem',
      fix: () => '…'
    },
    // No space after ellipsis when followed by capital (new sentence)
    {
      regex: /…([A-ZĄĆĘŁŃÓŚŹŻ])/g,
      reason: 'Brak spacji po wielokropku',
      fix: (m) => '… ' + m.slice(1)
    },

    // ===== OTHER PUNCTUATION =====

    // Double punctuation (except ?! and !?)
    {
      regex: /([.,:;])(\1)/g,
      reason: 'Podwójny znak interpunkcyjny',
      fix: (m) => m[0]
    },
    // Comma after period (typo)
    {
      regex: /\.,/g,
      reason: 'Przecinek po kropce',
      fix: () => '.'
    },
    // Period after comma (typo)
    {
      regex: /,\./g,
      reason: 'Kropka po przecinku',
      fix: () => ','
    },
    // Space before % (in Polish usually no space)
    {
      regex: /(\d) +%/g,
      reason: 'Spacja przed znakiem procentu',
      fix: (m) => m.replace(/ +%/, '%')
    },
  ];

  for (const { regex, reason, fix } of patterns) {
    let match;
    // Reset regex state
    regex.lastIndex = 0;

    while ((match = regex.exec(text)) !== null) {
      const originalText = match[0];
      const suggestedFix = fix(originalText);

      // Skip if fix is same as original (shouldn't happen but safety check)
      if (originalText === suggestedFix) continue;

      // Skip if this is within an InDesign word break
      if (indesignImport && isInDesignBreak(match.index, match.index + originalText.length)) {
        continue;
      }

      mistakes.push({
        originalText,
        suggestedFix,
        reason,
        category: 'formatting',
        position: {
          start: match.index,
          end: match.index + originalText.length
        }
      });
    }
  }

  // Sort by position
  mistakes.sort((a, b) => a.position.start - b.position.start);

  // Remove overlapping mistakes (keep first)
  const filtered: LocalMistake[] = [];
  let lastEnd = -1;
  for (const m of mistakes) {
    if (m.position.start >= lastEnd) {
      filtered.push(m);
      lastEnd = m.position.end;
    }
  }

  return filtered;
};

