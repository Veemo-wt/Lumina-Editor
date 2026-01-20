import OpenAI from 'openai';
import { BookGenre, GlossaryItem, CharacterTrait } from '../types';

interface TranslationRequest {
  chunkText: string;
  lookbackText: string;
  genre: BookGenre;
  tone: string;
  glossary: GlossaryItem[];
  characterBible?: CharacterTrait[];
  ragContext?: string; // New RAG context
  apiKey: string;
  model: string;
}

export interface TranslationResult {
  text: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

const createClient = (apiKey: string) => {
  if (!apiKey) throw new Error("API Key is missing");
  return new OpenAI({
    apiKey: apiKey,
    dangerouslyAllowBrowser: true
  });
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Filter context items to only include those relevant to the text.
 */
const filterRelevantContext = (text: string, glossary: GlossaryItem[], bible: CharacterTrait[]) => {
  const lowerText = text.toLowerCase();

  const relevantGlossary = glossary.filter(item => {
    const term = item.term.toLowerCase();
    return lowerText.includes(term);
  });

  const relevantBible = bible.filter(char => {
    // Fixed typo: constcF -> const
    const name = char.name.toLowerCase();
    return lowerText.includes(name);
  });

  return { relevantGlossary, relevantBible };
};

export const translateChunk = async (request: TranslationRequest): Promise<TranslationResult> => {
  const { chunkText, lookbackText, genre, tone, glossary, characterBible, ragContext, apiKey, model } = request;
  const client = createClient(apiKey);
  const targetModel = model || 'gpt-4o';

  const combinedContextText = lookbackText + "\n" + chunkText;
  const { relevantGlossary, relevantBible } = filterRelevantContext(combinedContextText, glossary, characterBible || []);

  const glossaryString = relevantGlossary
    .map(g => `TERM: "${g.term}" -> "${g.translation}" (${g.category}) - ${g.description || ''}`)
    .join('\n');

  const bibleString = relevantBible
    .map(c => `CHAR: "${c.name}" -> PL: "${c.polishName}" (${c.gender}, ${c.speechStyle || 'Normal'}) - ${c.notes || ''}`)
    .join('\n');

  // --- SYSTEM PROMPT CONSTRUCTION ---
  const systemPrompt = `
    You are a master literary translator specializing in translating high-quality literature into Polish.
    
    **PROJECT SETTINGS:**
    - Genre: ${genre}
    - Tone/Style: ${tone}
    
    **CORE INSTRUCTIONS:**
    1. **Typography:** Use Polish standards (e.g. „quotes”, em-dashes for dialogue).
    2. **Continuity:** Use 'Lookback' only for context. Do NOT translate it.
    3. **Consistency:** adhere strictly to Glossary and Character Bible.

    ${ragContext ? `
    **SIMILAR PAST TRANSLATIONS (RAG MEMORY):**
    Use these pairs to maintain stylistic consistency with previous chapters:
    ${ragContext}
    ` : ''}

    **CHARACTER BIBLE (Relevant):**
    ${bibleString.length > 0 ? bibleString : '(No specific characters found)'}
    
    **GLOSSARY (Relevant):**
    ${glossaryString.length > 0 ? glossaryString : '(No specific terms found)'}
  `;

  const userContent = `
    **LOOKBACK (Context only):**
    ${lookbackText}

    **TRANSLATE THIS TEXT:**
    ${chunkText}
  `;

  const temperature = targetModel.includes('mini') ? 1 : 0.3;

  let attempt = 0;
  const maxRetries = 3;

  while (attempt <= maxRetries) {
    try {
      const response = await client.chat.completions.create({
        model: targetModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent }
        ],
        temperature: temperature,
      });

      const text = response.choices[0]?.message?.content?.trim() || "";
      const usage = response.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

      return { text, usage };

    } catch (error: any) {
      if (error?.status === 429) {
        if (attempt === maxRetries) throw new Error("Rate limit exceeded.");
        const waitTime = (attempt + 1) * 15000;
        await delay(waitTime);
        attempt++;
        continue;
      }
      throw new Error(error?.message || "Failed to translate chunk.");
    }
  }
  throw new Error("Translation failed.");
};

export const detectGlossaryTerms = async (text: string, apiKey: string, model: string): Promise<GlossaryItem[]> => {
  const client = createClient(apiKey);
  const targetModel = model || 'gpt-4o';

  const systemPrompt = `You are a Senior Literary Editor. Extract Proper Nouns (Characters, Locations, Artifacts) from the text. Return JSON: { "items": [{ "term", "translation", "category", "description" }] }`;

  const userPrompt = `Analyze:\n"${text.slice(0, 15000)}..."`;

  try {
    const response = await client.chat.completions.create({
      model: targetModel,
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      response_format: { type: "json_object" }
    });
    const parsed = JSON.parse(response.choices[0]?.message?.content || "{}");
    return (parsed.items || []).map((p: any, idx: number) => ({
      id: `auto-${Date.now()}-${idx}`,
      term: p.term,
      translation: p.translation || p.term,
      description: p.description || '',
      category: p.category || 'other'
    }));
  } catch (e) { return []; }
};

export const extractGlossaryPairs = async (
  originalText: string,
  translatedText: string,
  existingGlossary: GlossaryItem[],
  apiKey: string,
  model: string
): Promise<GlossaryItem[]> => {
  const client = createClient(apiKey);
  const targetModel = model || 'gpt-4o';

  const systemPrompt = `Compare Source and Translation. Identify and extract Proper Nouns/Entities (Characters, Places, Artifacts). 
  Return JSON: { "items": [{ "term": "Original Name", "translation": "Polish Name", "category": "character"|"location"|"other", "description": "Context", "gender": "male"|"female"|"neutral"|"plural" }] }.
  
  CRITICAL INSTRUCTIONS FOR POLISH:
  1. **NOMINATIVE CASE ONLY**: The 'translation' field MUST be in the NOMINATIVE CASE (Mianownik), singular form.
     - Example: If text has "Geralta", output "Geralt".
     - Example: If text has "Ciri", output "Ciri".
     - Example: If text has "Wiedźmina", output "Wiedźmin".
  2. **GENDER DETECTION**: Infer gender carefully from context (pronouns he/she, titles like Mr/Mrs/King/Queen).
  3. **NO INFLECTIONS**: Do not create separate entries for inflected forms. Map them all to the single Nominative base.
  4. **Proper Nouns Only**: Do not extract common words unless they are capitalized specific entities.
  5. **POLISH DESCRIPTIONS**: The 'description' field MUST be written in POLISH.`;

  const userPrompt = `Source: ${originalText.slice(0, 5000)}\nTranslation: ${translatedText.slice(0, 5000)}\nExisting: ${existingGlossary.map(g => g.term).join(", ")}`;

  try {
    console.log(`[Auto-Glossary] Analyzing chunk for new terms...`);
    const response = await client.chat.completions.create({
      model: targetModel,
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      response_format: { type: "json_object" }
    });

    const content = response.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);

    const items = (parsed.items || []).map((p: any, idx: number) => ({
      id: `auto-${Date.now()}-${idx}`,
      term: p.term,
      translation: p.translation,
      description: p.description || '',
      category: p.category || 'other',
      gender: p.gender // Pass detected gender through
    }));

    console.log(`[Auto-Glossary] Found ${items.length} partial terms.`);
    return items;

  } catch (e: any) {
    console.error("[Auto-Glossary] Extraction failed:", e.message || e);
    // Don't swallow completely, return empty but let log show it
    return [];
  }
};