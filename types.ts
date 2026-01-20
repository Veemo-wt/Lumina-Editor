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

export interface ChunkData {
  id: number;
  originalText: string;
  translatedText: string | null;
  status: "pending" | "processing" | "completed" | "error";
  errorMsg?: string;
  sourceFileName?: string; // To track which chapter/file this chunk belongs to
}

export interface TranslationConfig {
  apiKey: string;
  model: string; // User-defined model (e.g. gpt-4o, gpt-4.1 if available)
  genre: BookGenre;
  tone: string; // e.g., "Formal", "Witty", "Archaic"
  glossary: GlossaryItem[];
  characterBible: CharacterTrait[];
  ragEntries: RagEntry[]; // In-memory RAG database
  chunkSize: number; // Target characters per chunk
  lookbackSize: number; // Characters to include from previous chunk
  chapterPattern?: string; // Regex pattern for detection e.g. "Chapter \d+"
}

export interface RawFile {
  name: string;
  content: string;
}

export type AppStage = "upload" | "config" | "processing" | "review";

