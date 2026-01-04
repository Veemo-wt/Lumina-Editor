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

const createClient = (apiKey: string) => {
  if (!apiKey) throw new Error("API Key is missing");
  return new OpenAI({
    apiKey: apiKey,
    dangerouslyAllowBrowser: true 
  });
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const translateChunk = async (request: TranslationRequest): Promise<string> => {
  const { chunkText, lookbackText, genre, tone, glossary, characterBible, apiKey, model } = request;
  const client = createClient(apiKey);
  const targetModel = model || 'gpt-4o';

  // Enhanced glossary formatting to emphasize context
  const glossaryString = glossary
    .map(g => `
      TERM: "${g.term}"
      TRANSLATION: "${g.translation}"
      TYPE: ${g.category}
      CONTEXT/TRAITS: ${g.description || 'No specific context.'}
    `.trim())
    .join('\n---\n');

  // Character Bible Formatting
  const bibleString = (characterBible || [])
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
       - Strictly adhere to the provided terms.
       - **CRITICAL:** Use the "CONTEXT/TRAITS" provided in the glossary to inform your translation choices. 
       
    **CHARACTER CONSISTENCY (Bible):**
    Use this bible to ensure correct grammatical gender (verbs/adjectives) and consistent naming.
    ${bibleString.length > 0 ? bibleString : 'No character bible provided.'}
    
    **Glossary Data:**
    ${glossaryString.length > 0 ? glossaryString : 'No specific glossary provided yet. Maintain internal consistency.'}
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

  // Temperature logic: gpt-5-mini requires 1, others get 0.3
  const temperature = targetModel === 'gpt-5-mini' ? 1 : 0.3;

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

      return response.choices[0]?.message?.content?.trim() || "";
    } catch (error: any) {
      console.error(`Attempt ${attempt + 1} failed:`, error);
      
      // Handle Rate Limiting specifically
      if (error?.status === 429) {
        if (attempt === maxRetries) {
          throw new Error("Rate limit exceeded. Please check your OpenAI Usage limits or wait a moment.");
        }
        
        // Exponential backoff: 15s, 30s, 45s
        const waitTime = (attempt + 1) * 15000; 
        console.warn(`Hit rate limit (429). Retrying in ${waitTime/1000}s...`);
        await delay(waitTime);
        attempt++;
        continue;
      }
      
      if (error?.status === 401) throw new Error("Invalid API Key. Please check your OpenAI credentials.");
      if (error?.status === 404) throw new Error(`Model '${targetModel}' not found. Please verify the model name.`);
      
      throw new Error(error?.message || "Failed to translate chunk.");
    }
  }
  
  throw new Error("Translation failed after max retries.");
};

/**
 * Extracts glossary terms from a source and translated text pair to auto-update the glossary.
 */
export const extractGlossaryPairs = async (
  originalText: string, 
  translatedText: string, 
  existingGlossary: GlossaryItem[],
  apiKey: string,
  model: string
): Promise<GlossaryItem[]> => {
  const client = createClient(apiKey);
  const targetModel = model || 'gpt-4o';
  
  const limit = 20000; 
  const sourceSample = originalText.slice(0, limit);
  const targetSample = translatedText.slice(0, limit);
  const existingTerms = existingGlossary.map(g => g.term).join(", ");

  const systemPrompt = `
    You are a literary analyst and glossary builder for a Polish publishing house.
    Analyze the aligned English source text and its Polish translation.
    Identify **NEW** important entities (Characters, Locations, Specific Objects) that need consistency tracking.
    
    **Requirements:**
    1. 'term': The English term.
    2. 'translation': The Polish translation used in the text.
    3. 'description': A concise description of the entity's role or context **IN POLISH**.
    4. 'category': one of [character, location, event, object, other].
    
    Return valid JSON.
  `;

  const userPrompt = `
    **Source:** ${sourceSample}...
    **Translation:** ${targetSample}...
    **Existing Terms (Ignore these):** ${existingTerms}
    
    Output JSON format: { "items": [{ "term": "...", "translation": "...", "category": "...", "description": "..." }] }
  `;

  try {
    // We don't need aggressive retry for this background task, but a simple one helps
    const response = await client.chat.completions.create({
      model: targetModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: "json_object" }
    });

    const raw = response.choices[0]?.message?.content || "{}";
    const parsedResult = JSON.parse(raw);
    const parsed = parsedResult.items || parsedResult.terms || [];

    return parsed.map((p: any, idx: number) => ({
      id: `auto-${Date.now()}-${idx}`,
      term: p.term,
      translation: p.translation,
      description: p.description || '',
      category: p.category || 'other'
    }));

  } catch (e: any) {
    if (e?.status === 429) {
      console.warn("Skipping glossary extraction due to rate limit.");
    } else {
      console.warn("Glossary extraction failed", e);
    }
    return [];
  }
};

export const detectGlossaryTerms = async (text: string, apiKey: string, model: string): Promise<GlossaryItem[]> => {
  const client = createClient(apiKey);
  const targetModel = model || 'gpt-4o';
  
  const systemPrompt = `
    You are a literary assistant preparing a book for translation into Polish.
    Analyze the provided text to identify key entities (Characters, Locations, Key Terms).
    
    **Requirements:**
    1. **Term**: The name/term.
    2. **Translation**: Propose a standard Polish translation (e.g., "King John" -> "Król Jan", or keep original if it's a name like "Smith").
    3. **Description**: Describe the character/location briefly **IN POLISH** (e.g., "Główny bohater, cyniczny detektyw").
    4. **Category**: [character, location, object, other].
    
    Return valid JSON.
  `;
  
  const userPrompt = `
    Analyze this text: ${text.slice(0, 15000)}...
    Return JSON: { "items": [{ "term": "...", "translation": "...", "category": "...", "description": "..." }] }
  `;

  try {
    const response = await client.chat.completions.create({
      model: targetModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: "json_object" }
    });
    
    const raw = response.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(raw);
    const items = parsed.items || [];
    
    return items.map((p: any, idx: number) => ({
      id: `auto-${Date.now()}-${idx}`,
      term: p.term,
      translation: p.translation || p.term, // Fallback to term if translation missing
      description: p.description || '',
      category: p.category || 'other'
    }));
  } catch (e) {
    console.warn("Glossary detection failed", e);
    return [];
  }
};