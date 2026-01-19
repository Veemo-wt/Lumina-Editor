
import OpenAI from 'openai';
import { BookGenre, GlossaryItem, CharacterTrait } from '../types';

interface TranslationRequest {
  chunkText: string;
  lookbackText: string;
  genre: BookGenre;
  tone: string;
  glossary: GlossaryItem[];
  characterBible?: CharacterTrait[];
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
 * This prevents context window overflow for massive glossaries.
 */
const filterRelevantContext = (text: string, glossary: GlossaryItem[], bible: CharacterTrait[]) => {
  const lowerText = text.toLowerCase();
  
  // Naive but effective keyword matching. 
  // For production, consider stemming or more advanced NLP if token limits are extremely tight.
  const relevantGlossary = glossary.filter(item => {
    const term = item.term.toLowerCase();
    // Check if term exists in text. 
    // Adding regex boundary checks (\b) helps avoid partial word matches 
    // but might miss some declined forms in Polish if checking translation side (we check Source here).
    return lowerText.includes(term); 
  });

  const relevantBible = bible.filter(char => {
    const name = char.name.toLowerCase();
    // Usually names are distinct enough
    return lowerText.includes(name);
  });

  return { relevantGlossary, relevantBible };
};

export const translateChunk = async (request: TranslationRequest): Promise<TranslationResult> => {
  const { chunkText, lookbackText, genre, tone, glossary, characterBible, apiKey, model } = request;
  const client = createClient(apiKey);
  const targetModel = model || 'gpt-4o';

  // --- SMART CONTEXT FILTERING ---
  // To avoid 400 Bad Request (Context Window Limit), we only send relevant data.
  // We check both the current chunk and the lookback text for references.
  const combinedContextText = lookbackText + "\n" + chunkText;
  const { relevantGlossary, relevantBible } = filterRelevantContext(combinedContextText, glossary, characterBible || []);

  const glossaryString = relevantGlossary
    .map(g => `
      TERM: "${g.term}"
      TRANSLATION: "${g.translation}"
      TYPE: ${g.category}
      CONTEXT/TRAITS: ${g.description || 'No specific context.'}
    `.trim())
    .join('\n---\n');

  const bibleString = relevantBible
    .map(c => `
      CHARACTER: "${c.name}" (PL: ${c.polishName})
      GENDER: ${c.gender}
      AGE: ${c.age || 'N/A'}
      SPEECH STYLE: ${c.speechStyle || 'Standard'}
      NOTES: ${c.notes || ''}
    `.trim())
    .join('\n---\n');

  const systemPrompt = `
    You are a master literary translator specializing in translating high-quality literature into Polish.
    
    **Context & Constraints:**
    - Genre: ${genre}
    - Desired Tone/Style: ${tone}
    - Target Audience: Polish native speakers (Publishing House Standard).
    
    **Critical Requirements:**
    1. **Typography:** You MUST use Polish typographic standards (e.g., „low quotes” for opening, ”high quotes” for closing). Use em-dashes (—) for dialogue.
    2. **Continuity:** Use the provided Lookback Context ONLY for flow, tone, and character voice continuity. Do not translate it.
    3. **Glossary & Rich Context:** 
       - Strictly adhere to the provided terms below.
       - **GLOSSARY PRIORITY:** If multiple terms in the glossary could apply to a phrase, ALWAYS prioritize the longer, more specific term.
       - **CRITICAL:** Use the "CONTEXT/TRAITS" provided in the glossary to inform your translation choices. 
       
    **CHARACTER CONSISTENCY (Relevant to this section):**
    ${bibleString.length > 0 ? bibleString : 'No specific character instructions for this section.'}
    
    **Glossary Data (Relevant to this section):**
    ${glossaryString.length > 0 ? glossaryString : 'No specific glossary terms found for this section.'}
  `;

  const userContent = `
    **Input Data:**
    
    --- START LOOKBACK CONTEXT (Read-only for flow) ---
    ${lookbackText}
    --- END LOOKBACK CONTEXT ---

    --- START TEXT TO TRANSLATE ---
    ${chunkText}
    --- END TEXT TO TRANSLATE ---

    **Output:**
    Provide ONLY the translated Polish text. No markdown blocks, no intro/outro.
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
      // If error is context length, we might want to retry with 0 context? 
      // For now, just throw the clearer error.
      throw new Error(error?.message || "Failed to translate chunk.");
    }
  }
  throw new Error("Translation failed.");
};

export const detectGlossaryTerms = async (text: string, apiKey: string, model: string): Promise<GlossaryItem[]> => {
  const client = createClient(apiKey);
  const targetModel = model || 'gpt-4o';
  
  const systemPrompt = `
    You are a Senior Literary Editor creating a "Series Bible" for a translation project.
    
    **YOUR GOAL:** Identify specific Proper Nouns and unique fictional terminology that requires consistent translation.
    
    **STRICT EXCLUSION RULES (DO NOT EXTRACT):**
    - DO NOT extract common nouns (e.g., "flu", "doctor", "kitchen", "sword", "king", "ship") unless they are part of a specific Proper Name (e.g. "The Black Pearl").
    - DO NOT extract medical conditions, weather, or standard emotions.
    - DO NOT extract verbs or common adjectives.
    
    **INCLUSION RULES (EXTRACT THESE):**
    1. **CHARACTERS:** Specific names of people or unique creatures (e.g. "Gandalf", "Wookies").
    2. **LOCATIONS:** Specific named places (e.g. "Winterfell", "The Green Dragon Inn").
    3. **OBJECTS:** Named artifacts or unique technology (e.g. "Excalibur", "Flux Capacitor").
    4. **EVENTS:** Specific named historical/plot events (e.g. "The Red Wedding").
    
    Return the result as a JSON object with a list of items.
  `;
  
  const userPrompt = `
    Analyze this text excerpt (first 15k chars): 
    "${text.slice(0, 15000)}..."
    
    Return JSON format: 
    { "items": [{ "term": "English Term", "translation": "Suggested Polish Translation", "category": "character" | "location" | "event" | "object", "description": "Brief context" }] }
  `;

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
  
  const systemPrompt = `
    You are a Translation Consistency Assistant.
    Compare the Source text and the Translation.
    
    **TASK:** Identify **NEW Proper Nouns** (Characters, Places, Named Artifacts) that appeared in this text but are NOT in the 'Existing Terms' list.
    
    **RULES:**
    - IGNORE common words (flu, car, house, running).
    - IGNORE standard vocabulary translations.
    - ONLY return significant Named Entities that need to be saved for future consistency.
    
    Return JSON.
  `;
  
  const userPrompt = `
    Source: ${originalText.slice(0, 5000)}
    Translation: ${translatedText.slice(0, 5000)}
    
    Existing Terms (Ignore these): ${existingGlossary.map(g => g.term).join(", ")}
    
    Return JSON: { "items": [{ "term", "translation", "category", "description" }] }
  `;

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
      translation: p.translation,
      description: p.description || '',
      category: p.category || 'other'
    }));
  } catch (e) { return []; }
};
