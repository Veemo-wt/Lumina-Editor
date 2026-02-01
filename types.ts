export enum BookGenre {
  LITERATURA_PIEKNA = "Literatura Piękna",
  FANTASTYKA_SCIFI = "Fantastyka / Sci-Fi",
  KRYMINAL_THRILLER = "Kryminał / Thriller",
  BIOGRAFIA_WSPOMNIENIA = "Biografia / Wspomnienia",
  AKADEMICKA_EDUKACYJNA = "Akademicka / Edukacyjna",
  LITERATURA_MLODZIEZOWA = "Literatura Młodzieżowa (YA)",
  ROMANS = "Romans",
  POWIESC_HISTORYCZNA = "Powieść Historyczna",
  DZIECIECA = "Dziecięca",
  REPORTAZ = "Reportaż",
  POPULARNONAUKOWA = "Popularnonaukowa",
  PORADNIK_ROZWOJ = "Poradnik / Rozwój Osobisty",
  PSYCHOLOGIA = "Psychologia",
  FILOZOFIA = "Filozofia",
  BIZNES_EKONOMIA = "Biznes / Ekonomia",
  TECHNOLOGIA_IT = "Technologia / IT",
  RELIGIA = "Religia",
  PODROZE = "Podróże",
  KULINARIA = "Kulinaria",
  ZDROWIE_MEDYCYNA = "Zdrowie / Medycyna",
}

export interface GlossaryItem {
  id: string;
  term: string;
  translation: string;
  description?: string; // np. "Główna postać", "Nazwa miasta"
  category: "character" | "location" | "event" | "object" | "other";
}

export interface CharacterTrait {
  id: string;
  name: string; // Imię postaci w oryginale
  polishName: string; // Imię postaci po polsku
  gender: "male" | "female" | "neutral" | "plural";
  age?: string; // np. "Nastolatek", "Starsza osoba", "Dziecko"
  speechStyle?: string; // np. "Formalny", "Slangowy", "Archaiczny", "Jąkający się"
  role?: string; // np. "Protagonista", "Antagonista"
  notes?: string;
}

export interface RagEntry {
  id: string;
  sourceText: string;
  translatedText: string;
  vector: number[];
  sourceOrigin?: string; // np. "Tom 1 - Rozdział 5"
}

export interface ProcessingStats {
  totalCharacters: number;
  processedCharacters: number;
  currentChunkIndex: number;
  totalChunks: number;
  estimatedTimeRemaining: number; // w sekundach
  startTime: number;
}

// Błąd znaleziony przez AI lub wykrycie lokalne
export interface Mistake {
  id: string;
  chunkId: number;
  originalText: string;      // Nieprawidłowy tekst
  suggestedFix: string;      // Proponowana poprawka
  reason: string;            // Dlaczego to błąd (gramatyka, ortografia itp.)
  category: 'grammar' | 'orthography' | 'punctuation' | 'style' | 'gender' | 'localization' | 'formatting' | 'other';
  position: {
    start: number;           // Pozycja znaku we fragmencie
    end: number;
  };
  status: 'pending' | 'approved' | 'rejected';
  source: 'ai' | 'local';    // Czy wykryto przez AI czy lokalne reguły
}

export interface ChunkData {
  id: number;
  originalText: string;
  correctedText: string | null;  // Tekst po zastosowaniu zatwierdzonych poprawek
  mistakes: Mistake[];           // Lista błędów znalezionych w tym fragmencie
  status: "pending" | "processing" | "completed" | "error";
  errorMsg?: string;
  sourceFileName?: string; // Do śledzenia, do którego rozdziału/pliku należy ten fragment
}

export interface ScanOptions {
  checkGrammar: boolean;
  checkOrthography: boolean;
  checkGender: boolean;
  checkStyle: boolean;
  checkPunctuation: boolean;
  checkLocalization: boolean;
  checkFormatting: boolean;
  wrapThoughtsInQuotes: boolean;
  indesignImport: boolean;
  preserveDocxFormatting: boolean; // Zachowaj bold/italic przy imporcie i eksporcie DOCX
}

export interface TranslationConfig {
  apiKey: string;
  model: string;
  scanOptions: ScanOptions; // Zastępuje genre/tone
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
