import { ChunkData, GlossaryItem, RawFile } from '../types';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import JSZip from 'jszip';

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs';

/**
 * Standard length-based splitter. Used as a fallback or for huge chapters.
 * Splits at newlines to preserve paragraph integrity.
 */
const chunkByLength = (text: string, targetSize: number): string[] => {
  const chunks: string[] = [];
  const lines = text.split('\n');
  
  let currentChunkText = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // If adding this line exceeds the limit and we have content, push the chunk
    if ((currentChunkText.length + line.length) > targetSize && currentChunkText.length > 0) {
      chunks.push(currentChunkText);
      currentChunkText = '';
    }
    // Preserve the newline when rebuilding
    currentChunkText += line + '\n';
  }

  // Push the final chunk
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
      translatedText: null,
      status: 'pending'
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
        translatedText: null,
        status: 'pending',
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
      translatedText: null,
      status: 'pending'
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
      translatedText: null,
      status: 'pending',
      sourceFileName: title
    });
  } else {
    // Too big, split it up
    const subChunks = chunkByLength(text, limit);
    subChunks.forEach((sc, idx) => {
      outputArray.push({
        originalText: sc,
        translatedText: null,
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
  const file = new Blob([content], {type: 'text/plain'});
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

/**
 * Helper to process ArrayBuffer for PDF
 */
const parsePdfBuffer = async (buffer: ArrayBuffer): Promise<string> => {
  const loadingTask = pdfjsLib.getDocument({ data: buffer });
  const pdf = await loadingTask.promise;
  
  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ');
    fullText += pageText + '\n\n';
  }
  return fullText;
};

export const extractTextFromPdf = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  return parsePdfBuffer(arrayBuffer);
};

/**
 * Helper to process ArrayBuffer for Docx
 */
const parseDocxBuffer = async (buffer: ArrayBuffer): Promise<string> => {
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return result.value;
};

export const extractTextFromDocx = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  return parseDocxBuffer(arrayBuffer);
};

export const extractTextFromZip = async (file: File): Promise<RawFile[]> => {
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
        text = await fileEntry.async('string');
      } else if (ext === 'docx') {
        const buffer = await fileEntry.async('arraybuffer');
        text = await parseDocxBuffer(buffer);
      } else if (ext === 'pdf') {
        const buffer = await fileEntry.async('arraybuffer');
        text = await parsePdfBuffer(buffer);
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