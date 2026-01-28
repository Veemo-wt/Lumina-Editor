
export enum BookGenre {
  FICTION_LITERARY = "Literatura Piękna",
  FICTION_FANTASY = "Fantastyka / Sci-Fi",
  FICTION_THRILLER = "Kryminał / Thriller",
  NON_FICTION_BIO = "Biografia / Wspomnienia",
  NON_FICTION_ACADEMIC = "Akademicka / Edukacyjna",
  YOUNG_ADULT = "Literatura Młodzieżowa (YA)",
  ROMANCE = "Romans",
  HISTORICAL_FICTION = "Powieść Historyczna",
  CHILDREN = "Dziecięca",
  REPORTAGE = "Reportaż",
  POPULAR_SCIENCE = "Popularnonaukowa",
  SELF_HELP = "Poradnik / Rozwój Osobisty",
  PSYHOLOGY = "Psychologia",
  PHILOSOPHY = "Filozodia",
  BUISNESS = "Biznes / Ekonomia",
  TECHNOLOGY = "Technolofia / IT",
  RELIGION = "Religia",
  TRAVEL = "Podróże",
  COOKING = "Kulinaria",
  HEALTH = "Zdrowie / Medycyna",
}

export interface GlossaryItem {
  id: string;
  term: string;
  translation: string;
  description?: string; // e.g., "Main character", "City name"
  category: "character" | "location" | "event" | "object" | "other";
}

export interface CharacterTrait {
  id: string;
  name: string; // The character name in Source
  polishName: string; // The character name in Target (Polish)
  gender: "male" | "female" | "neutral" | "plural";
  age?: string; // e.g. "Teenager", "Elderly", "Child"
  speechStyle?: string; // e.g. "Formal", "Slang", "Archaic", "Stutters"
  role?: string; // e.g. "Protagonist", "Antagonist"
  notes?: string;
}

export interface RagEntry {
  id: string;
  sourceText: string;
  translatedText: string;
  vector: number[];
  sourceOrigin?: string; // e.g. "Tome 1 - Chapter 5"
}

export interface ProcessingStats {
  totalCharacters: number;
  processedCharacters: number;
  currentChunkIndex: number;
  totalChunks: number;
  estimatedTimeRemaining: number; // in seconds
  startTime: number;
}

// Mistake found by AI or local detection
export interface Mistake {
  id: string;
  chunkId: number;
  originalText: string;      // The incorrect text
  suggestedFix: string;      // The proposed correction
  reason: string;            // Why it's a mistake (grammar, spelling, etc.)
  category: 'grammar' | 'orthography' | 'punctuation' | 'style' | 'gender' | 'localization' | 'formatting' | 'other';
  position: {
    start: number;           // Character position in chunk
    end: number;
  };
  status: 'pending' | 'approved' | 'rejected';
  source: 'ai' | 'local';    // Whether detected by AI or local rules
}

export interface ChunkData {
  id: number;
  originalText: string;
  correctedText: string | null;  // Text after applying approved fixes
  mistakes: Mistake[];           // List of mistakes found in this chunk
  status: "pending" | "processing" | "completed" | "error";
  errorMsg?: string;
  sourceFileName?: string; // To track which chapter/file this chunk belongs to
}

export interface ScanOptions {
  checkGrammar: boolean;
  checkOrthography: boolean;
  checkGender: boolean;
  checkStyle: boolean;
  checkPunctuation: boolean;
  checkLocalization: boolean;
  checkFormatting: boolean;
}

export interface TranslationConfig {
  apiKey: string;
  model: string;
  scanOptions: ScanOptions; // Replaces genre/tone
  glossary: GlossaryItem[];
  characterBible: CharacterTrait[];
  ragEntries: RagEntry[];
  chunkSize: number;
  lookbackSize: number;
  chapterPattern?: string;
}

export interface RawFile {
  name: string;
  content: string;
}

export type AppStage = "upload" | "config" | "processing" | "review";
