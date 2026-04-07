// ============================================================
// PII Detection & Redaction — Scan text for personal information
// ============================================================

export interface PIIMatch {
  type: string;
  value: string;
  start: number;
  end: number;
}

export interface PIIScanResult {
  hasPII: boolean;
  matches: PIIMatch[];
  redacted: string;
}

// ─── PII Patterns ───────────────────────────────────────────

const PII_PATTERNS: Array<{ type: string; pattern: RegExp }> = [
  // Email addresses
  { type: 'email', pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },

  // Phone numbers (international and Vietnamese formats)
  { type: 'phone', pattern: /(?:\+?84|0)(?:\d[\s.-]?){8,10}\b/g },
  { type: 'phone', pattern: /\+?\d{1,3}[\s.-]?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}\b/g },

  // Vietnamese national ID (CCCD: 12 digits, old CMND: 9 digits)
  { type: 'national_id', pattern: /\b\d{12}\b/g },
  { type: 'national_id', pattern: /\b\d{9}\b/g },

  // Credit card numbers (basic Luhn-length patterns)
  { type: 'credit_card', pattern: /\b(?:\d{4}[\s.-]?){3}\d{4}\b/g },

  // IP addresses
  { type: 'ip_address', pattern: /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g },

  // Social security / tax ID
  { type: 'ssn', pattern: /\b\d{3}-\d{2}-\d{4}\b/g },

  // Vietnamese address patterns (số nhà + đường/phố)
  { type: 'address', pattern: /(?:số\s+)?\d+[\s/]?\w*\s+(?:đường|phố|ngõ|hẻm|ngách)\s+[\p{L}\s]+/giu },

  // Passport numbers
  { type: 'passport', pattern: /\b[A-Z]{1,2}\d{6,8}\b/g },

  // Date of birth patterns
  { type: 'date_of_birth', pattern: /\b(?:sinh\s+(?:ngày\s+)?|born\s+(?:on\s+)?|DOB[:\s]+)\d{1,2}[\s/.-]\d{1,2}[\s/.-]\d{2,4}/gi },
];

// Redaction masks per type
const REDACT_MASKS: Record<string, string> = {
  email: '[EMAIL]',
  phone: '[PHONE]',
  national_id: '[ID]',
  credit_card: '[CARD]',
  ip_address: '[IP]',
  ssn: '[SSN]',
  address: '[ADDRESS]',
  passport: '[PASSPORT]',
  date_of_birth: '[DOB]',
};

/**
 * Scan text for PII and optionally redact it.
 */
export function scanPII(text: string): PIIScanResult {
  const matches: PIIMatch[] = [];

  for (const { type, pattern } of PII_PATTERNS) {
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      // Filter out false positives: short digit sequences that are likely not PII
      if (type === 'national_id' && match[0].length === 9) {
        // 9-digit number: only flag if surrounded by context clues
        const before = text.slice(Math.max(0, match.index - 30), match.index).toLowerCase();
        if (!before.includes('cmnd') && !before.includes('cccd') && !before.includes('chứng minh') && !before.includes('căn cước')) {
          continue;
        }
      }
      matches.push({
        type,
        value: match[0],
        start: match.index,
        end: match.index + match[0].length,
      });
    }
  }

  // Deduplicate overlapping matches (keep the longer one)
  const deduped = deduplicateMatches(matches);

  // Redact: replace matches from end to start to preserve offsets
  let redacted = text;
  const sorted = [...deduped].sort((a, b) => b.start - a.start);
  for (const m of sorted) {
    const mask = REDACT_MASKS[m.type] || '[REDACTED]';
    redacted = redacted.slice(0, m.start) + mask + redacted.slice(m.end);
  }

  return {
    hasPII: deduped.length > 0,
    matches: deduped,
    redacted,
  };
}

function deduplicateMatches(matches: PIIMatch[]): PIIMatch[] {
  if (matches.length <= 1) return matches;
  const sorted = [...matches].sort((a, b) => a.start - b.start || b.end - a.end);
  const result: PIIMatch[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const prev = result[result.length - 1];
    if (sorted[i].start < prev.end) {
      // Overlapping — keep the longer
      if (sorted[i].end - sorted[i].start > prev.end - prev.start) {
        result[result.length - 1] = sorted[i];
      }
    } else {
      result.push(sorted[i]);
    }
  }
  return result;
}
