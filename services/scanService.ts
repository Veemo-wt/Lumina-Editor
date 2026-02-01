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

/**
 * Preserves formatting markers (**bold** and *italic*) from original text in the suggested fix.
 * AI often strips these markers, so we need to restore them.
 */
const preserveFormattingMarkers = (original: string, suggested: string): string => {
    // Extract formatting info from original
    const boldMatches: Array<{ text: string; start: number; end: number }> = [];
    const italicMatches: Array<{ text: string; start: number; end: number }> = [];

    // Find **bold** segments
    const boldRegex = /\*\*(.+?)\*\*/g;
    let match;
    while ((match = boldRegex.exec(original)) !== null) {
        boldMatches.push({
            text: match[1], // text without markers
            start: match.index,
            end: match.index + match[0].length
        });
    }

    // Find *italic* segments (but not **)
    const italicRegex = /(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g;
    while ((match = italicRegex.exec(original)) !== null) {
        italicMatches.push({
            text: match[1],
            start: match.index,
            end: match.index + match[0].length
        });
    }

    // If no formatting in original, return suggested as-is
    if (boldMatches.length === 0 && italicMatches.length === 0) {
        return suggested;
    }

    // Check if suggested already has formatting (AI preserved it)
    const suggestedHasBold = /\*\*.+?\*\*/.test(suggested);
    const suggestedHasItalic = /(?<!\*)\*(?!\*).+?(?<!\*)\*(?!\*)/.test(suggested);

    if (suggestedHasBold || suggestedHasItalic) {
        // AI preserved formatting, return as-is
        return suggested;
    }

    // Strip markers from original for comparison
    const originalStripped = original
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '$1');

    // If suggested equals stripped original, the fix was just about text not formatting
    // Try to re-apply formatting markers

    let result = suggested;

    // Re-apply bold formatting
    for (const bold of boldMatches) {
        // Find where this bold text appears in suggested
        const idx = result.indexOf(bold.text);
        if (idx !== -1) {
            // Check if already has markers
            const before = result.slice(Math.max(0, idx - 2), idx);
            const after = result.slice(idx + bold.text.length, idx + bold.text.length + 2);
            if (before !== '**' && after !== '**') {
                result = result.slice(0, idx) + '**' + bold.text + '**' + result.slice(idx + bold.text.length);
            }
        }
    }

    // Re-apply italic formatting
    for (const italic of italicMatches) {
        const idx = result.indexOf(italic.text);
        if (idx !== -1) {
            // Check if already has markers (and not part of bold)
            const before = result.slice(Math.max(0, idx - 1), idx);
            const after = result.slice(idx + italic.text.length, idx + italic.text.length + 1);
            const beforeBold = result.slice(Math.max(0, idx - 2), idx);
            const afterBold = result.slice(idx + italic.text.length, idx + italic.text.length + 2);

            if (before !== '*' && after !== '*' && beforeBold !== '**' && afterBold !== '**') {
                result = result.slice(0, idx) + '*' + italic.text + '*' + result.slice(idx + italic.text.length);
            }
        }
    }

    return result;
};

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
    const footnoteSeparator = '\n---\n';
    const separatorIdx = chunkText.indexOf(footnoteSeparator);
    const mainTextEnd = separatorIdx === -1 ? chunkText.length : separatorIdx;

    const normalizeWithMap = (text: string) => {
        let normalized = '';
        const map: number[] = [];
        let lastWasSpace = false;

        for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            if (/\s/.test(ch)) {
                if (!lastWasSpace) {
                    normalized += ' ';
                    map.push(i);
                    lastWasSpace = true;
                }
                continue;
            }
            normalized += ch.toLowerCase();
            map.push(i);
            lastWasSpace = false;
        }

        return { normalized, map };
    };

    const normalizeNeedle = (text: string) => {
        return text.replace(/\s+/g, ' ').trim().toLowerCase();
    };

    const findNormalizedInRange = (text: string, needle: string, start: number, end: number): { start: number; end: number } | null => {
        const limited = text.slice(0, end);
        const { normalized, map } = normalizeWithMap(limited);
        const normalizedNeedle = normalizeNeedle(needle);
        if (!normalizedNeedle) return null;

        let startNorm = 0;
        for (let i = 0; i < map.length; i++) {
            if (map[i] >= start) {
                startNorm = i;
                break;
            }
        }

        const foundNorm = normalized.indexOf(normalizedNeedle, startNorm);
        if (foundNorm === -1) return null;

        const startOriginal = map[foundNorm] ?? 0;
        const endNorm = Math.min(foundNorm + normalizedNeedle.length - 1, map.length - 1);
        const endOriginal = (map[endNorm] ?? startOriginal) + 1;

        return { start: startOriginal, end: endOriginal };
    };

    const findIndexInRange = (text: string, needle: string, start: number, end: number): number => {
        const limited = text.slice(0, end);
        let idx = limited.indexOf(needle, start);
        if (idx !== -1) return idx;

        const lowerLimited = limited.toLowerCase();
        const lowerNeedle = needle.toLowerCase();
        idx = lowerLimited.indexOf(lowerNeedle, start);
        return idx;
    };

    const safeStart = startSearchFrom < mainTextEnd ? startSearchFrom : 0;

    // Prefer matching within main text (before footnotes)
    let start = findIndexInRange(chunkText, originalText, safeStart, mainTextEnd);
    if (start === -1 && safeStart > 0) {
        // If mistakes arrive out of order, retry from the beginning
        start = findIndexInRange(chunkText, originalText, 0, mainTextEnd);
    }

    if (start !== -1) {
        return { start, end: start + originalText.length };
    }

    const normalizedMainMatch = findNormalizedInRange(chunkText, originalText, safeStart, mainTextEnd);
    if (normalizedMainMatch) {
        return normalizedMainMatch;
    }

    // Fallback: try the footnote section if present
    if (separatorIdx !== -1) {
        const footnoteStart = separatorIdx + footnoteSeparator.length;
        start = findIndexInRange(chunkText, originalText, footnoteStart, chunkText.length);
        if (start !== -1) {
            return { start, end: start + originalText.length };
        }
        const normalizedFootnoteMatch = findNormalizedInRange(chunkText, originalText, footnoteStart, chunkText.length);
        if (normalizedFootnoteMatch) {
            return normalizedFootnoteMatch;
        }
    }

    return { start: 0, end: 0 };
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
    if (scanOptions.checkStyle) checks.push("- STYLE: Readability issues, awkward phrasing, repetitive words, unclear sentences. Suggest improvements for better flow and clarity");
    if (scanOptions.checkPunctuation) checks.push(`- PUNCTUATION: Polish punctuation rules. BE VERY CAREFUL and CONSERVATIVE:
      * Do NOT add commas before "i", "oraz", "lub", "albo", "ani", "czy" when they connect equal parts
      * Do NOT change "i" to comma - Polish allows multiple "i" conjunctions in a sentence
      * Comma IS required before "i" ONLY when it starts a new independent clause (with its own subject+verb)
      * Comma IS required before: "który", "która", "które", "że", "żeby", "aby", "ponieważ", "gdyż", "choć", "chociaż", "jeśli", "jeżeli", "gdy", "kiedy"
      * Comma separates clauses in compound sentences
      * Use Polish dialogue dashes (–) not hyphens (-) for dialogue
      * Report ONLY clear punctuation errors, NOT stylistic preferences`);
    if (scanOptions.checkLocalization) checks.push("- LOCALIZATION: Identify calques, literal translations of idioms/sayings from other languages. Suggest natural Polish equivalents or rephrasings that preserve meaning but sound native");
    if (scanOptions.wrapThoughtsInQuotes) checks.push(`- THOUGHTS: Find character's internal thoughts/monologue that are NOT wrapped in Polish quotation marks „..." and suggest adding them. Internal thoughts should be distinguished from narration.`);

    // Note: FORMATTING (double spaces, spaces before punctuation) is handled locally without AI

    // Build rules list - conditionally include stylistic preferences rule
    const rules = [
        "Each mistake must include the EXACT original text as it appears",
        "Do NOT process or analyze the LOOKBACK section - it's only for context",
        "Return JSON format only",
        "ALWAYS assign a category to each mistake - never leave it empty",
        "For PUNCTUATION: Be VERY conservative - only report CLEAR errors. When in doubt, do NOT report. Polish punctuation is flexible.",
        "PRESERVE FORMATTING: If original text contains **bold** or *italic* markers, keep them in the suggested fix in the same positions"
    ];

    // Only add anti-style rule if style check is disabled
    if (!scanOptions.checkStyle) {
        rules.unshift("Return ONLY actual mistakes, not stylistic preferences");
    }

    const systemPrompt = `You are a professional Polish editor and proofreader.
Your task is to FIND MISTAKES in the provided Polish text based on these enabled checks:

${checks.join('\n')}

**IMPORTANT RULES:**
${rules.map((r, i) => `${i + 1}. ${r}`).join('\n')}

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
      "category": "grammar|orthography|punctuation|style|gender|localization|formatting|other"
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

                const category = ['grammar', 'orthography', 'punctuation', 'style', 'gender', 'localization', 'formatting', 'other'].includes(raw.category)
                    ? raw.category as Mistake['category']
                    : 'other';

                // Preserve formatting markers from original in the suggested fix
                const suggestedWithFormatting = preserveFormattingMarkers(raw.original, raw.suggested);

                mistakes.push({
                    id: `${chunkId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    chunkId,
                    originalText: raw.original,
                    suggestedFix: suggestedWithFormatting,
                    reason: raw.reason || 'Błąd wykryty przez AI',
                    category,
                    position,
                    status: 'pending',
                    source: 'ai'
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
