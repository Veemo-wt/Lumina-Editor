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
 * - If original has formatting, ensure suggested keeps it
 * - If original has NO formatting, remove any formatting AI added to suggested
 */
const preserveFormattingMarkers = (original: string, suggested: string): string => {
    // Check if original has any formatting
    const originalHasBold = /\*\*.+?\*\*/.test(original);
    const originalHasItalic = /(?<!\*)\*(?!\*).+?(?<!\*)\*(?!\*)/.test(original);

    // Check if suggested has any formatting
    const suggestedHasBold = /\*\*.+?\*\*/.test(suggested);
    const suggestedHasItalic = /(?<!\*)\*(?!\*).+?(?<!\*)\*(?!\*)/.test(suggested);

    // CASE 1: Original has NO formatting - strip any formatting AI added
    if (!originalHasBold && !originalHasItalic) {
        if (suggestedHasBold || suggestedHasItalic) {
            // AI added formatting that wasn't in original - remove it
            return suggested
                .replace(/\*\*(.+?)\*\*/g, '$1')
                .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '$1');
        }
        return suggested;
    }

    // CASE 2: Original has formatting - try to preserve it in suggested

    // If AI already preserved formatting, return as-is
    if (suggestedHasBold || suggestedHasItalic) {
        return suggested;
    }

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
    if (!apiKey) throw new Error("Brak klucza API");
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
// Returns { start: -1, end: -1 } if not found (to distinguish from position 0)
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

    // STRATEGY 1: Try exact match from startSearchFrom
    let start = findIndexInRange(chunkText, originalText, safeStart, mainTextEnd);
    if (start !== -1) {
        return { start, end: start + originalText.length };
    }

    // STRATEGY 2: Try exact match from beginning (AI may return mistakes out of order)
    if (safeStart > 0) {
        start = findIndexInRange(chunkText, originalText, 0, mainTextEnd);
        if (start !== -1) {
            return { start, end: start + originalText.length };
        }
    }

    // STRATEGY 3: Try normalized match from startSearchFrom
    const normalizedMainMatch = findNormalizedInRange(chunkText, originalText, safeStart, mainTextEnd);
    if (normalizedMainMatch) {
        return normalizedMainMatch;
    }

    // STRATEGY 4: Try normalized match from beginning
    if (safeStart > 0) {
        const normalizedFromStart = findNormalizedInRange(chunkText, originalText, 0, mainTextEnd);
        if (normalizedFromStart) {
            return normalizedFromStart;
        }
    }

    // STRATEGY 5: Fallback - try the footnote section if present
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

    // Not found - return -1 to indicate failure (not position 0!)
    return { start: -1, end: -1 };
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
        .map(g => `TERMIN: "${g.term}" -> "${g.translation}" (${g.category}) - ${g.description || ''}`)
        .join('\n');

    const bibleString = relevantBible
        .map(c => `POSTAĆ: "${c.name}" -> PL: "${c.polishName}" (${c.gender}, ${c.speechStyle || 'Normalny'}) - ${c.notes || ''}`)
        .join('\n');

    // Build checks list
    const checks = [];
    if (scanOptions.checkGrammar) checks.push("- GRAMATYKA: Błędy gramatyczne, koniugacja, deklinacja");
    if (scanOptions.checkOrthography) checks.push("- ORTOGRAFIA: Błędy ortograficzne");
    if (scanOptions.checkGender) checks.push("- RODZAJ: Spójność rodzaju z Biblią postaci");
    if (scanOptions.checkStyle) checks.push("- STYL: Problemy z czytelnością, niezręczne sformułowania, powtarzające się słowa, niejasne zdania. Sugeruj ulepszenia dla lepszej płynności i przejrzystości");
    if (scanOptions.checkPunctuation) checks.push(`- INTERPUNKCJA: Polskie zasady interpunkcji. Bądź BARDZO OSTROŻNY i ZACHOWAWCZY:
      * NIE dodawaj przecinków przed "i", "oraz", "lub", "albo", "ani", "czy" gdy łączą równorzędne części
      * NIE zamieniaj "i" na przecinek - polski dopuszcza wielokrotne spójniki "i" w zdaniu
      * Przecinek JEST wymagany przed "i" TYLKO gdy rozpoczyna nowe zdanie niezależne (z własnym podmiotem+orzeczeniem)
      * Przecinek JEST wymagany przed: "który", "która", "które", "że", "żeby", "aby", "ponieważ", "gdyż", "choć", "chociaż", "jeśli", "jeżeli", "gdy", "kiedy"
      * Przecinek rozdziela zdania w zdaniach złożonych
      * Używaj polskich pauz dialogowych (–) nie łączników (-) w dialogach
      * Zgłaszaj TYLKO wyraźne błędy interpunkcyjne, NIE preferencje stylistyczne`);
    if (scanOptions.checkLocalization) checks.push("- LOKALIZACJA: Identyfikuj kalki językowe, dosłowne tłumaczenia idiomów/powiedzeń z innych języków. Sugeruj naturalne polskie odpowiedniki lub przeformułowania, które zachowują znaczenie, ale brzmią naturalnie");
    if (scanOptions.wrapThoughtsInQuotes) checks.push(`- MYŚLI: Znajdź wewnętrzne myśli/monolog postaci, które NIE są otoczone polskimi cudzysłowami „..." i zasugeruj ich dodanie. Myśli wewnętrzne powinny być odróżnione od narracji.`);

    // Note: FORMATTING (double spaces, spaces before punctuation) is handled locally without AI

    // Build rules list - conditionally include stylistic preferences rule
    const rules = [
        "Każdy błąd musi zawierać DOKŁADNY oryginalny tekst tak, jak się pojawia",
        "NIE przetwarzaj ani nie analizuj sekcji KONTEKST WSTECZNY - służy tylko jako kontekst",
        "Zwróć tylko format JSON",
        "ZAWSZE przypisuj kategorię do każdego błędu - nigdy nie zostawiaj pustej",
        "Dla INTERPUNKCJI: Bądź BARDZO zachowawczy - zgłaszaj tylko WYRAŹNE błędy. W razie wątpliwości NIE zgłaszaj. Polska interpunkcja jest elastyczna.",
        "FORMATOWANIE: NIE DODAWAJ znaczników **pogrubienia** ani *kursywy* do tekstu, który ich nie miał. Zachowaj formatowanie TYLKO tam, gdzie było w oryginale. Jeśli oryginalny tekst nie zawiera znaczników formatowania, sugerowana poprawka też nie może ich zawierać."
    ];

    // Only add anti-style rule if style check is disabled
    if (!scanOptions.checkStyle) {
        rules.unshift("Zwracaj TYLKO rzeczywiste błędy, nie preferencje stylistyczne");
    }

    const systemPrompt = `Jesteś profesjonalnym polskim redaktorem i korektorem.
Twoim zadaniem jest ZNALEZIENIE BŁĘDÓW w dostarczonym polskim tekście na podstawie włączonych sprawdzeń:

${checks.join('\n')}

**WAŻNE ZASADY:**
${rules.map((r, i) => `${i + 1}. ${r}`).join('\n')}

**KONTEKST POSTACI:**
${bibleString.length > 0 ? bibleString : '(Brak)'}

**SŁOWNIK:**
${glossaryString.length > 0 ? glossaryString : '(Brak)'}

**FORMAT WYJŚCIOWY - Zwróć prawidłową tablicę JSON:**
{
  "mistakes": [
    {
      "original": "dokładny tekst z błędem",
      "suggested": "poprawiony tekst",
      "reason": "Krótkie wyjaśnienie po polsku",
      "category": "grammar|orthography|punctuation|style|gender|localization|formatting|other"
    }
  ]
}

Jeśli nie znaleziono błędów, zwróć: {"mistakes": []}`;

    const userContent = `**KONTEKST WSTECZNY (Tylko jako odniesienie, NIE analizuj):**
${lookbackText || "(Brak)"}

**TEKST DO ANALIZY:**
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

                // Check if original and suggested are identical (no actual change proposed)
                const isIdentical = raw.original === raw.suggested;

                // Normalize for comparison: whitespace, quotes, dashes
                const normalize = (s: string) => s
                    .replace(/\s+/g, ' ')
                    .replace(/[„""''«»]/g, '"')
                    .replace(/[–—−]/g, '-')
                    .trim();
                const normalizedOriginal = normalize(raw.original);
                const normalizedSuggested = normalize(raw.suggested);
                const isNormalizedIdentical = normalizedOriginal === normalizedSuggested;

                // Skip truly identical suggestions (AI found nothing to change)
                if (isIdentical || isNormalizedIdentical) {
                    console.log('[ScanService] Skipping identical original/suggested:', raw.original.slice(0, 50));
                    continue;
                }

                const position = findMistakePosition(chunkText, raw.original, lastPosition);

                // Skip mistakes that couldn't be located in the text
                if (position.start === -1) {
                    console.warn('[ScanService] Could not locate mistake in text, skipping:', raw.original.slice(0, 50));
                    continue;
                }

                // Only update lastPosition if we found a valid position
                lastPosition = position.end;

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
                if (attempt === maxRetries) throw new Error("Przekroczono limit zapytań.");
                const waitTime = (attempt + 1) * 15000;
                await delay(waitTime);
                attempt++;
                continue;
            }
            throw new Error(error?.message || "Nie udało się zeskanować fragmentu.");
        }
    }
    throw new Error("Scanning failed.");
};
