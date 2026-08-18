export type FootnoteParseMethod = 'separator' | 'trailing-defs' | 'arrows' | 'none';

export interface ParsedTextWithFootnotes {
  mainText: string;
  footnotes: Map<number, string>;
  method: FootnoteParseMethod;
}

export type RichTextBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'spacer'; lines: number }
  | { type: 'separator'; marker: string };

export interface InlineTextToken {
  type: 'text';
  text: string;
  bold: boolean;
  italics: boolean;
  underline: boolean;
}

export interface InlineFootnoteRefToken {
  type: 'footnoteRef';
  footnoteNumber: number;
}

export type InlineToken = InlineTextToken | InlineFootnoteRefToken;

export interface InlineParseStats {
  plainRuns: number;
  boldRuns: number;
  italicRuns: number;
  boldItalicRuns: number;
  footnoteRefs: number;
  unmatchedSingleMarkers: number;
  unmatchedDoubleMarkers: number;
  unmatchedTripleMarkers: number;
  strippedMarkerChars: number;
}

export interface InlineFormattedSegment {
  text: string;
  bold: boolean;
  italics: boolean;
  underline: boolean;
}

interface TextStyle {
  bold: boolean;
  italics: boolean;
  underline: boolean;
}

type LegacyMarker = '*' | '**' | '***' | '__';
type StyleKey = keyof TextStyle;

interface HtmlFormattingTag {
  raw: string;
  kind: 'open' | 'close';
  styleKey: StyleKey;
  closeRaw?: string;
}

const FOOTNOTE_DEF_RE = /^\[\^?(\d+)\]:\s*(.*)$/;
const FOOTNOTE_REF_RE = /^\[\^?(\d+)\]/;

const normalizeNewlines = (text: string): string => text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

const createInlineStats = (): InlineParseStats => ({
  plainRuns: 0,
  boldRuns: 0,
  italicRuns: 0,
  boldItalicRuns: 0,
  footnoteRefs: 0,
  unmatchedSingleMarkers: 0,
  unmatchedDoubleMarkers: 0,
  unmatchedTripleMarkers: 0,
  strippedMarkerChars: 0,
});

const HTML_TAGS: HtmlFormattingTag[] = [
  { raw: '<strong>', kind: 'open', styleKey: 'bold', closeRaw: '</strong>' },
  { raw: '</strong>', kind: 'close', styleKey: 'bold' },
  { raw: '<b>', kind: 'open', styleKey: 'bold', closeRaw: '</b>' },
  { raw: '</b>', kind: 'close', styleKey: 'bold' },
  { raw: '<em>', kind: 'open', styleKey: 'italics', closeRaw: '</em>' },
  { raw: '</em>', kind: 'close', styleKey: 'italics' },
  { raw: '<i>', kind: 'open', styleKey: 'italics', closeRaw: '</i>' },
  { raw: '</i>', kind: 'close', styleKey: 'italics' },
  { raw: '<u>', kind: 'open', styleKey: 'underline', closeRaw: '</u>' },
  { raw: '</u>', kind: 'close', styleKey: 'underline' },
];

interface ParseFootnoteDefBlockResult {
  footnotes: Map<number, string>;
  valid: boolean;
}

interface ParsedSectionFootnotes {
  footnotes: Map<number, string>;
  method: Exclude<FootnoteParseMethod, 'none'>;
}

const FOOTNOTE_SECTION_SEPARATOR_PATTERNS = [
  /\n---+\n/g,
  /\n={3,}\n/g,
  /\n\*{3,}\n/g,
  /\n(?:NOTES?|ENDNOTES?|FOOTNOTES?|PRZYPISY|UWAGI)\s*\n/gi,
];

const DISPLAY_SEPARATOR_LINE_RE = /^(\*{3,}|-{3,}|={3,})$/;

const wrapTextWithStyle = (text: string, style: Pick<TextStyle, 'bold' | 'italics' | 'underline'>): string => {
  let wrapped = text;

  if (style.italics) {
    wrapped = `<em>${wrapped}</em>`;
  }
  if (style.bold) {
    wrapped = `<strong>${wrapped}</strong>`;
  }
  if (style.underline) {
    wrapped = `<u>${wrapped}</u>`;
  }

  return wrapped;
};

const hasActiveFormatting = (style: TextStyle): boolean => style.bold || style.italics || style.underline;

const parseFootnoteDefinitionBlock = (section: string): ParseFootnoteDefBlockResult => {
  const footnotes = new Map<number, string>();
  const lines = normalizeNewlines(section).split('\n');

  let hasDefinition = false;
  let invalidLeadingContent = false;
  let currentNum: number | null = null;
  let currentParts: string[] = [];

  const flushCurrent = () => {
    if (currentNum === null) return;
    const content = currentParts.join(' ').replace(/\s+/g, ' ').replace(/↑/g, '').trim();
    if (content) {
      footnotes.set(currentNum, content);
    }
    currentNum = null;
    currentParts = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const defMatch = line.match(FOOTNOTE_DEF_RE);

    if (defMatch) {
      flushCurrent();
      currentNum = parseInt(defMatch[1], 10);
      currentParts = defMatch[2].trim() ? [defMatch[2].trim()] : [];
      hasDefinition = true;
      continue;
    }

    if (currentNum !== null) {
      const trimmed = line.trim();
      if (trimmed) {
        currentParts.push(trimmed);
      }
      continue;
    }

    if (line.trim()) {
      invalidLeadingContent = true;
    }
  }

  flushCurrent();

  return {
    footnotes,
    valid: hasDefinition && !invalidLeadingContent,
  };
};

const parseArrowFootnotes = (section: string): Map<number, string> => {
  if (!section.includes('↑')) {
    return new Map();
  }

  const parts = section
    .split('↑')
    .map((part) => part.replace(/^\d+[.)\]]\s*/, '').trim())
    .filter((part) => part.length > 0);

  const footnotes = new Map<number, string>();
  parts.forEach((part, idx) => {
    footnotes.set(idx + 1, part);
  });

  return footnotes;
};

const hasMatchingFootnoteReferences = (mainText: string, footnotes: Map<number, string>): boolean => {
  if (footnotes.size === 0) return false;
  const refs = Array.from(mainText.matchAll(/\[\^?(\d+)\]/g)).map((m) => parseInt(m[1], 10));
  if (refs.length === 0) return false;

  const defSet = new Set<number>(Array.from(footnotes.keys()));
  return refs.some((ref) => defSet.has(ref));
};

const parseSectionFootnotes = (
  mainCandidate: string,
  sectionCandidate: string,
  method: Exclude<FootnoteParseMethod, 'none'>
): ParsedSectionFootnotes | null => {
  const parsedDefs = parseFootnoteDefinitionBlock(sectionCandidate);
  if (parsedDefs.valid && hasMatchingFootnoteReferences(mainCandidate, parsedDefs.footnotes)) {
    return {
      footnotes: parsedDefs.footnotes,
      method,
    };
  }

  const arrowFootnotes = parseArrowFootnotes(sectionCandidate);
  if (hasMatchingFootnoteReferences(mainCandidate, arrowFootnotes)) {
    return {
      footnotes: arrowFootnotes,
      method,
    };
  }

  return null;
};

const findSplitAfterLastReference = (text: string): number => {
  const refs = [...text.matchAll(/\[\^?(\d+)\]/g)];
  if (refs.length === 0) return -1;

  const lastRef = refs[refs.length - 1];
  const lastRefEnd = (lastRef.index ?? 0) + lastRef[0].length;

  for (let i = lastRefEnd; i < Math.min(text.length, lastRefEnd + 2000); i++) {
    const char = text[i];
    if (char === '.' || char === '!' || char === '?') {
      const nextChar = text[i + 1];
      if (!nextChar || /\s/.test(nextChar)) {
        return i + 1;
      }
    }
  }

  return lastRefEnd;
};

export const parseTextWithFootnotes = (inputText: string): ParsedTextWithFootnotes => {
  const text = normalizeNewlines(inputText);

  for (const pattern of FOOTNOTE_SECTION_SEPARATOR_PATTERNS) {
    const matches = Array.from(text.matchAll(pattern));
    for (let i = matches.length - 1; i >= 0; i -= 1) {
      const match = matches[i];
      if (match.index === undefined) {
        continue;
      }

      const mainCandidate = text.slice(0, match.index).trimEnd();
      const sectionCandidate = text.slice(match.index + match[0].length).trim();
      const parsed = parseSectionFootnotes(mainCandidate, sectionCandidate, 'separator');

      if (parsed) {
        return {
          mainText: mainCandidate,
          footnotes: parsed.footnotes,
          method: parsed.method,
        };
      }
    }
  }

  const definitionStarts: number[] = [];
  const defLineRegex = /\n\[\^?\d+\]:/g;
  let defLineMatch: RegExpExecArray | null;
  while ((defLineMatch = defLineRegex.exec(text)) !== null) {
    definitionStarts.push(defLineMatch.index + 1);
  }

  for (let i = definitionStarts.length - 1; i >= 0; i--) {
    const startIdx = definitionStarts[i];
    const mainCandidate = text.slice(0, startIdx).trimEnd();
    const sectionCandidate = text.slice(startIdx).trim();
    const parsed = parseSectionFootnotes(mainCandidate, sectionCandidate, 'trailing-defs');

    if (parsed) {
      return {
        mainText: mainCandidate,
        footnotes: parsed.footnotes,
        method: parsed.method,
      };
    }
  }

  if (text.includes('↑')) {
    const splitPoint = findSplitAfterLastReference(text);
    if (splitPoint > 0 && splitPoint < text.length) {
      const mainCandidate = text.slice(0, splitPoint).trimEnd();
      const sectionCandidate = text.slice(splitPoint).trim();
      const arrowFootnotes = parseArrowFootnotes(sectionCandidate);

      if (hasMatchingFootnoteReferences(mainCandidate, arrowFootnotes)) {
        return {
          mainText: mainCandidate,
          footnotes: arrowFootnotes,
          method: 'arrows',
        };
      }
    }
  }

  return {
    mainText: text,
    footnotes: new Map<number, string>(),
    method: 'none',
  };
};

const findClosingMarker = (text: string, marker: LegacyMarker, from: number): number => {
  for (let i = from; i < text.length; i++) {
    if (marker === '***') {
      if (text.startsWith('***', i)) {
        return i;
      }
      continue;
    }

    if (marker === '**') {
      if (text.startsWith('***', i)) {
        return i + 1;
      }
      if (text.startsWith('**', i)) {
        return i;
      }
      continue;
    }

    if (marker === '__') {
      if (text.startsWith('__', i)) {
        return i;
      }
      continue;
    }

    if (text[i] !== '*') {
      continue;
    }

    if (text.startsWith('***', i)) {
      return i;
    }

    if (text.startsWith('**', i)) {
      i += 1;
      continue;
    }

    return i;
  }

  return -1;
};

const toggleStyle = (style: TextStyle, marker: LegacyMarker): TextStyle => {
  if (marker === '***') {
    return { bold: !style.bold, italics: !style.italics, underline: style.underline };
  }
  if (marker === '**') {
    return { bold: !style.bold, italics: style.italics, underline: style.underline };
  }
  if (marker === '__') {
    return { bold: style.bold, italics: style.italics, underline: !style.underline };
  }
  return { bold: style.bold, italics: !style.italics, underline: style.underline };
};

const matchHtmlFormattingTag = (text: string, idx: number): HtmlFormattingTag | null => {
  for (const tag of HTML_TAGS) {
    if (text.startsWith(tag.raw, idx)) {
      return tag;
    }
  }
  return null;
};

const applyHtmlFormattingTag = (style: TextStyle, tag: HtmlFormattingTag): TextStyle => ({
  ...style,
  [tag.styleKey]: tag.kind === 'open',
});

export const parseInlineTokens = (
  inputText: string,
  options?: { stripUnmatchedMarkers?: boolean; allowLegacyMarkers?: boolean }
): { tokens: InlineToken[]; stats: InlineParseStats } => {
  const stripUnmatchedMarkers = options?.stripUnmatchedMarkers ?? true;
  const allowLegacyMarkers = options?.allowLegacyMarkers ?? false;
  const tokens: InlineToken[] = [];
  const stats = createInlineStats();

  const pushText = (text: string, style: TextStyle) => {
    if (!text) return;
    const last = tokens[tokens.length - 1];
    if (
      last &&
      last.type === 'text' &&
      last.bold === style.bold &&
      last.italics === style.italics &&
      last.underline === style.underline
    ) {
      last.text += text;
      return;
    }

    tokens.push({
      type: 'text',
      text,
      bold: style.bold,
      italics: style.italics,
      underline: style.underline,
    });
  };

  const parseSegment = (segment: string, baseStyle: TextStyle) => {
    let idx = 0;
    let style = { ...baseStyle };

    while (idx < segment.length) {
      const rest = segment.slice(idx);
      const footnoteMatch = rest.match(FOOTNOTE_REF_RE);
      if (footnoteMatch) {
        tokens.push({
          type: 'footnoteRef',
          footnoteNumber: parseInt(footnoteMatch[1], 10),
        });
        idx += footnoteMatch[0].length;
        continue;
      }

      const htmlTag = matchHtmlFormattingTag(segment, idx);
      if (htmlTag) {
        if (htmlTag.kind === 'open') {
          if (htmlTag.closeRaw && segment.indexOf(htmlTag.closeRaw, idx + htmlTag.raw.length) !== -1) {
            style = applyHtmlFormattingTag(style, htmlTag);
            idx += htmlTag.raw.length;
            continue;
          }
        } else if (style[htmlTag.styleKey]) {
          style = applyHtmlFormattingTag(style, htmlTag);
          idx += htmlTag.raw.length;
          continue;
        }
      }

      let marker: LegacyMarker | null = null;
      if (allowLegacyMarkers) {
        if (segment.startsWith('***', idx)) {
          marker = '***';
        } else if (segment.startsWith('**', idx)) {
          marker = '**';
        } else if (segment.startsWith('__', idx)) {
          marker = '__';
        } else if (segment[idx] === '*') {
          marker = '*';
        }
      }

      if (marker) {
        const closeIdx = findClosingMarker(segment, marker, idx + marker.length);
        if (closeIdx !== -1) {
          const inner = segment.slice(idx + marker.length, closeIdx);
          parseSegment(inner, toggleStyle(style, marker));
          idx = closeIdx + marker.length;
          continue;
        }

        if (marker === '***') stats.unmatchedTripleMarkers += 1;
        else if (marker === '**' || marker === '__') stats.unmatchedDoubleMarkers += 1;
        else stats.unmatchedSingleMarkers += 1;

        if (stripUnmatchedMarkers) {
          stats.strippedMarkerChars += marker.length;
        } else {
          pushText(marker, style);
        }

        idx += marker.length;
        continue;
      }

      let nextIdx = segment.length;
      if (allowLegacyMarkers) {
        const nextStar = segment.indexOf('*', idx);
        if (nextStar !== -1) {
          nextIdx = Math.min(nextIdx, nextStar);
        }

        const nextUnderscore = segment.indexOf('_', idx);
        if (nextUnderscore !== -1) {
          nextIdx = Math.min(nextIdx, nextUnderscore);
        }
      }

      const nextBracket = segment.indexOf('[', idx);
      if (nextBracket !== -1) {
        nextIdx = Math.min(nextIdx, nextBracket);
      }

      const nextTag = segment.indexOf('<', idx);
      if (nextTag !== -1) {
        nextIdx = Math.min(nextIdx, nextTag);
      }

      if (nextIdx === idx) {
        pushText(segment[idx], style);
        idx += 1;
      } else {
        pushText(segment.slice(idx, nextIdx), style);
        idx = nextIdx;
      }
    }
  };

  parseSegment(inputText, { bold: false, italics: false, underline: false });

  if (tokens.length === 0) {
    tokens.push({ type: 'text', text: '', bold: false, italics: false, underline: false });
  }

  for (const token of tokens) {
    if (token.type === 'footnoteRef') {
      stats.footnoteRefs += 1;
      continue;
    }

    if (token.bold && token.italics) {
      stats.boldItalicRuns += 1;
    } else if (token.bold) {
      stats.boldRuns += 1;
    } else if (token.italics) {
      stats.italicRuns += 1;
    } else {
      stats.plainRuns += 1;
    }
  }

  return { tokens, stats };
};

export const serializeInlineTokens = (
  tokens: InlineToken[],
  format: 'html' | 'plain' = 'html'
): string => tokens.map((token) => {
  if (token.type === 'footnoteRef') {
    return `[${token.footnoteNumber}]`;
  }

  if (format === 'plain' || !hasActiveFormatting(token)) {
    return token.text;
  }

  return wrapTextWithStyle(token.text, token);
}).join('');

export const normalizeRichTextFormatting = (inputText: string, options?: { allowLegacyMarkers?: boolean }): string =>
  normalizeNewlines(inputText)
    .split('\n')
    .map((line) => serializeInlineTokens(parseInlineTokens(line, {
      stripUnmatchedMarkers: false,
      allowLegacyMarkers: options?.allowLegacyMarkers,
    }).tokens, 'html'))
    .join('\n');

export const stripRichTextFormatting = (inputText: string, options?: { allowLegacyMarkers?: boolean }): string =>
  normalizeNewlines(inputText)
    .split('\n')
    .map((line) => serializeInlineTokens(parseInlineTokens(line, {
      stripUnmatchedMarkers: false,
      allowLegacyMarkers: options?.allowLegacyMarkers,
    }).tokens, 'plain'))
    .join('\n');

export const hasRichTextFormatting = (inputText: string, options?: { allowLegacyMarkers?: boolean }): boolean =>
  normalizeNewlines(inputText)
    .split('\n')
    .some((line) =>
      parseInlineTokens(line, {
        stripUnmatchedMarkers: false,
        allowLegacyMarkers: options?.allowLegacyMarkers,
      }).tokens.some(
        (token) => token.type === 'text' && hasActiveFormatting(token)
      )
    );

export const collectFormattedSegments = (inputText: string, options?: { allowLegacyMarkers?: boolean }): InlineFormattedSegment[] => {
  const segments: InlineFormattedSegment[] = [];

  for (const line of normalizeNewlines(inputText).split('\n')) {
    const { tokens } = parseInlineTokens(line, {
      stripUnmatchedMarkers: false,
      allowLegacyMarkers: options?.allowLegacyMarkers,
    });
    tokens.forEach((token) => {
      if (token.type === 'text' && hasActiveFormatting(token) && token.text.trim()) {
        segments.push({
          text: token.text,
          bold: token.bold,
          italics: token.italics,
          underline: token.underline,
        });
      }
    });
  }

  return segments;
};

export const getRichTextBlocks = (inputText: string): RichTextBlock[] => {
  const normalizedText = normalizeNewlines(inputText);
  if (!normalizedText) {
    return [];
  }

  const blocks: RichTextBlock[] = [];
  let spacerLines = 0;

  const flushSpacer = () => {
    if (spacerLines > 0) {
      blocks.push({ type: 'spacer', lines: spacerLines });
      spacerLines = 0;
    }
  };

  for (const rawLine of normalizedText.split('\n')) {
    const trimmed = rawLine.trim();

    if (!trimmed) {
      spacerLines += 1;
      continue;
    }

    flushSpacer();

    const separatorMatch = trimmed.match(DISPLAY_SEPARATOR_LINE_RE);
    if (separatorMatch) {
      blocks.push({ type: 'separator', marker: separatorMatch[1].slice(0, 3) });
      continue;
    }

    blocks.push({ type: 'paragraph', text: rawLine });
  }

  flushSpacer();

  return blocks;
};

export const sanitizeDocxText = (text: string): string => {
  return text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u0084\u0086-\u009F]/g, '');
};
