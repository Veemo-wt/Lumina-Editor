import { ChunkData, GlossaryItem, CharacterTrait, RawFile, RagEntry } from '../types';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import JSZip from 'jszip';

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs';

export const createWorldPackage = async (
  glossary: GlossaryItem[],
  characterBible: CharacterTrait[],
  ragEntries: RagEntry[]
): Promise<Blob> => {
  const zip = new JSZip();
  
  // 1. Metadata JSON (Lightweight)
  const metadata = {
    version: "2.0",
    createdAt: new Date().toISOString(),
    project: "Lumina World Knowledge Pack",
    glossary,
    characterBible
  };
  zip.file("metadata.json", JSON.stringify(metadata, null, 2));

  // 2. RAG Database (Heavy)
  // We separate it to allow partial imports if needed in future
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

  // 1. Parse Metadata
  if (loadedZip.file("metadata.json")) {
    const metaStr = await loadedZip.file("metadata.json")?.async("string");
    if (metaStr) {
      const meta = JSON.parse(metaStr);
      glossary = meta.glossary || [];
      characterBible = meta.characterBible || [];
    }
  } 
  // Legacy support for plain JSON exports (if any)
  else if (file.name.endsWith('.json')) {
     const text = await file.text();
     const json = JSON.parse(text);
     return { 
       glossary: json.glossary || [], 
       characterBible: json.characterBible || [], 
       ragEntries: [] 
     };
  }

  // 2. Parse RAG Store
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