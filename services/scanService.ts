import OpenAI from 'openai';
import { GlossaryItem, CharacterTrait, ScanOptions, Mistake } from '../types';

interface ScanRequest {
    chunkId: number;
    chunkText: string;
    lookbackText: string;
    scanOptions: ScanOptions;
    glossary: GlossaryItem[];
    characterBible?: CharacterTrait[];
    apiKey: string;
    model: string;
}

export interface ScanResult {
    mistakes: Mistake[];
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

interface RawMistake {
    original: string;
    suggested: string;
    reason: string;
    category: string;
}

const createClient = (apiKey: string) => {
    if (!apiKey) throw new Error("API Key is missing");
    return new OpenAI({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true
    });
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const filterRelevantContext = (text: string, glossary: GlossaryItem[], bible: CharacterTrait[]) => {
    const lowerText = text.toLowerCase();

    const relevantGlossary = glossary.filter(item => {
        const term = item.term.toLowerCase();
        return lowerText.includes(term);
    });

    const relevantBible = bible.filter(char => {
        const name = char.name.toLowerCase();
        return lowerText.includes(name);
    });

    return { relevantGlossary, relevantBible };
};

// Find position of mistake in the chunk text
const findMistakePosition = (chunkText: string, originalText: string, startSearchFrom: number = 0): { start: number; end: number } => {
    const start = chunkText.indexOf(originalText, startSearchFrom);
    if (start === -1) {
        // Fallback: try case-insensitive search
        const lowerChunk = chunkText.toLowerCase();
        const lowerOriginal = originalText.toLowerCase();
        const fallbackStart = lowerChunk.indexOf(lowerOriginal, startSearchFrom);
        if (fallbackStart !== -1) {
            return { start: fallbackStart, end: fallbackStart + originalText.length };
        }
        return { start: 0, end: originalText.length };
    }
    return { start, end: start + originalText.length };
};

export const scanChunk = async (request: ScanRequest): Promise<ScanResult> => {
    const { chunkId, chunkText, lookbackText, scanOptions, glossary, characterBible, apiKey, model } = request;

    console.log('[ScanService] Starting scanChunk...', { model, textLen: chunkText.length, options: scanOptions });

    const client = createClient(apiKey);
    const targetModel = model || 'gpt-4o';
    console.log('[ScanService] Using model:', targetModel);

    const combinedContextText = lookbackText + "\n" + chunkText;
    const { relevantGlossary, relevantBible } = filterRelevantContext(combinedContextText, glossary, characterBible || []);

    const glossaryString = relevantGlossary
        .map(g => `TERM: "${g.term}" -> "${g.translation}" (${g.category}) - ${g.description || ''}`)
        .join('\n');

    const bibleString = relevantBible
        .map(c => `CHAR: "${c.name}" -> PL: "${c.polishName}" (${c.gender}, ${c.speechStyle || 'Normal'}) - ${c.notes || ''}`)
        .join('\n');

    // Build checks list
    const checks = [];
    if (scanOptions.checkGrammar) checks.push("- GRAMMAR: Grammatical errors, conjugation, declension");
    if (scanOptions.checkOrthography) checks.push("- ORTHOGRAPHY: Spelling mistakes");
    if (scanOptions.checkGender) checks.push("- GENDER: Gender consistency with Character Bible");
    if (scanOptions.checkStyle) checks.push("- STYLE: Readability and flow issues");
    if (scanOptions.checkPunctuation) checks.push("- PUNCTUATION: Polish punctuation rules (commas, dialogue dashes)");

    const systemPrompt = `You are a professional Polish editor and proofreader.
Your task is to FIND MISTAKES in the provided Polish text based on these enabled checks:

${checks.join('\n')}

**IMPORTANT RULES:**
1. Return ONLY actual mistakes, not stylistic preferences
2. Each mistake must include the EXACT original text as it appears
3. Do NOT process or analyze the LOOKBACK section - it's only for context
4. Return JSON format only

**CHARACTER CONTEXT:**
${bibleString.length > 0 ? bibleString : '(None)'}

**GLOSSARY:**
${glossaryString.length > 0 ? glossaryString : '(None)'}

**OUTPUT FORMAT - Return valid JSON array:**
{
  "mistakes": [
    {
      "original": "exact text with mistake",
      "suggested": "corrected text",
      "reason": "Brief explanation in Polish",
      "category": "grammar|orthography|punctuation|style|gender|other"
    }
  ]
}

If no mistakes found, return: {"mistakes": []}`;

    const userContent = `**LOOKBACK (Context only, do NOT analyze):**
${lookbackText || "(None)"}

**TEXT TO ANALYZE:**
${chunkText}`;

    let attempt = 0;
    const maxRetries = 3;

    while (attempt <= maxRetries) {
        try {
            console.log('[ScanService] Making API call...', { targetModel, attempt });
            const response = await client.chat.completions.create({
                model: targetModel,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userContent }
                ],
                temperature: 0.2,
                response_format: { type: "json_object" }
            });
            console.log('[ScanService] API response received');

            const content = response.choices[0]?.message?.content?.trim() || '{"mistakes":[]}';
            const usage = response.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

            // Parse the JSON response
            let parsed: { mistakes: RawMistake[] };
            try {
                parsed = JSON.parse(content);
            } catch (parseErr) {
                console.error('[ScanService] Failed to parse JSON:', content);
                parsed = { mistakes: [] };
            }

            // Convert raw mistakes to Mistake objects with positions
            const mistakes: Mistake[] = [];
            let lastPosition = 0;

            for (const raw of (parsed.mistakes || [])) {
                if (!raw.original || !raw.suggested) continue;

                const position = findMistakePosition(chunkText, raw.original, lastPosition);
                lastPosition = position.end; // Search for next mistake after this one

                const category = ['grammar', 'orthography', 'punctuation', 'style', 'gender', 'other'].includes(raw.category)
                    ? raw.category as Mistake['category']
                    : 'other';

                mistakes.push({
                    id: `${chunkId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    chunkId,
                    originalText: raw.original,
                    suggestedFix: raw.suggested,
                    reason: raw.reason || 'Błąd wykryty przez AI',
                    category,
                    position,
                    status: 'pending'
                });
            }

            console.log('[ScanService] Found mistakes:', mistakes.length);
            return { mistakes, usage };

        } catch (error: any) {
            console.error('[ScanService] API error:', error);
            if (error?.status === 429) {
                if (attempt === maxRetries) throw new Error("Rate limit exceeded.");
                const waitTime = (attempt + 1) * 15000;
                await delay(waitTime);
                attempt++;
                continue;
            }
            throw new Error(error?.message || "Failed to scan chunk.");
        }
    }
    throw new Error("Scanning failed.");
};
