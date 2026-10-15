"use strict";

/* ------------------------------------------------------------------
   text-xray  —  reveal hidden / fake characters in pasted text
   Pure JS, no dependencies. Works offline.
   ------------------------------------------------------------------ */

/* Non-ASCII characters that are visually identical (or near-identical)
   to a Latin letter. Based on the Unicode Confusables table (UTR#39),
   trimmed to the practical Latin look-alikes.
   NOTE: NFKC normalization does NOT catch these. */
const CONFUSABLE = {
  // Cyrillic
  "А": "A", "Б": "B", "В": "B", "Е": "E", "Н": "H", "І": "I", "Ј": "J",
  "К": "K", "М": "M", "О": "O", "Р": "P", "С": "C", "Т": "T", "Х": "X", "У": "Y",
  "а": "a", "в": "b", "с": "c", "е": "e", "і": "i", "ј": "j", "к": "k", "м": "m",
  "о": "o", "р": "p", "ѕ": "s", "т": "t", "у": "y", "х": "x", "ӏ": "l",
  // Greek
  "Α": "A", "Β": "B", "Ε": "E", "Η": "H", "Ι": "I", "Κ": "K", "Μ": "M", "Ν": "N",
  "Ο": "O", "Ρ": "P", "Τ": "T", "Χ": "X", "Υ": "Y", "Ζ": "Z",
  "α": "a", "β": "b", "δ": "d", "ε": "e", "η": "h", "ι": "i", "κ": "k", "μ": "m",
  "ο": "o", "ρ": "p", "τ": "t", "υ": "u", "ω": "w", "χ": "x", "ζ": "z",
  // Latin extended / letterlike / fullwidth
  "ᴀ": "A", "ı": "i", "０": "0", "１": "1", "２": "2", "３": "3", "４": "4",
  "５": "5", "６": "6", "７": "7", "８": "8", "９": "9",
  "Ａ": "A", "Ｂ": "B", "Ｃ": "C", "Ｄ": "D", "Ｅ": "E", "Ｆ": "F", "Ｇ": "G",
  "Ｈ": "H", "Ｉ": "I", "Ｊ": "J", "Ｋ": "K", "Ｌ": "L", "Ｍ": "M", "Ｎ": "N",
  "Ｏ": "O", "Ｐ": "P", "Ｑ": "Q", "Ｒ": "R", "Ｓ": "S", "Ｔ": "T", "Ｕ": "U",
  "Ｖ": "V", "Ｗ": "W", "Ｘ": "X", "Ｙ": "Y", "Ｚ": "Z",
  "ａ": "a", "ｂ": "b", "ｃ": "c", "ｄ": "d", "ｅ": "e", "ｆ": "f", "ｇ": "g",
  "ｈ": "h", "ｉ": "i", "ｊ": "j", "ｋ": "k", "ｌ": "l", "ｍ": "m", "ｎ": "n",
  "ｏ": "o", "ｐ": "p", "ｑ": "q", "ｒ": "r", "ｓ": "s", "ｔ": "t", "ｕ": "u",
  "ｖ": "v", "ｗ": "w", "ｘ": "x", "ｙ": "y", "ｚ": "z",
};

/* Characters that render as nothing (or nearly nothing) but still
   count as characters, break string matching, and change tokenization. */
const INVISIBLE = {
  0x200B: "ZERO WIDTH SPACE",
  0x200C: "ZERO WIDTH NON-JOINER",
  0x200D: "ZERO WIDTH JOINER",
  0x2060: "WORD JOINER",
  0xFEFF: "ZERO WIDTH NO-BREAK SPACE (BOM)",
  0x00AD: "SOFT HYPHEN",
  0x180E: "MONGOLIAN VOWEL SEPARATOR",
  0x200E: "LEFT-TO-RIGHT MARK",
  0x200F: "RIGHT-TO-LEFT MARK",
  0x202A: "LEFT-TO-RIGHT EMBEDDING",
  0x202B: "RIGHT-TO-LEFT EMBEDDING",
  0x202C: "POP DIRECTIONAL FORMATTING",
  0x202D: "LEFT-TO-RIGHT OVERRIDE",
  0x202E: "RIGHT-TO-LEFT OVERRIDE",
  0x2066: "LEFT-TO-RIGHT ISOLATE",
  0x2067: "RIGHT-TO-LEFT ISOLATE",
  0x2068: "FIRST STRONG ISOLATE",
  0x2069: "POP DIRECTIONAL ISOLATE",
  0x2061: "FUNCTION APPLICATION",
  0x2062: "INVISIBLE TIMES",
  0x2063: "INVISIBLE SEPARATOR",
  0x2064: "INVISIBLE PLUS",
  0x0600: "ARABIC NUMBER SIGN",
  0x0601: "ARABIC SIGN SANAH",
  0x0602: "ARABIC FOOTNOTE MARKER",
  0x0603: "ARABIC SIGN SAFHA",
  0x061C: "ARABIC LETTER MARK",
};

const GSM7_BASIC =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789" +
  " !\"#%&'()*+,-./:;<=>?@£§ÄÖÑÜäöñüà¿";
const GSM7_EXT = "^{}[~]|\\`";

function scriptOf(cp) {
  if (cp < 128) return "ASCII";
  if (cp >= 0x0400 && cp <= 0x047f) return "Cyrillic";
  if (cp >= 0x0370 && cp <= 0x03ff) return "Greek";
  if (cp >= 0xff00 && cp <= 0xff5f) return "Fullwidth Latin";
  if (cp >= 0x1d00 && cp <= 0x1d7f) return "Phonetic Extensions";
  if (cp >= 0x2100 && cp <= 0x214f) return "Letterlike Symbols";
  if (cp >= 0x1d400 && cp <= 0x1d7ff) return "Mathematical Alphanumeric";
  if (cp >= 0x00c0 && cp <= 0x00ff) return "Latin-1 Supplement";
  if (cp >= 0x0100 && cp <= 0x017f) return "Latin Extended-A";
  if (cp >= 0x0300 && cp <= 0x036f) return "Combining Diacritical Marks";
  if (cp >= 0x0600 && cp <= 0x06ff) return "Arabic";
  if (cp >= 0x4e00 && cp <= 0x9fff) return "CJK Unified Ideographs";
  if (cp >= 0x3040 && cp <= 0x309f) return "Hiragana";
  if (cp >= 0x30a0 && cp <= 0x30ff) return "Katakana";
  if (cp >= 0xac00 && cp <= 0xd7ff) return "Hangul";
  if (cp >= 0x0900 && cp <= 0x097f) return "Devanagari";
  if (cp >= 0x0e00 && cp <= 0x0e7f) return "Thai";
  if (cp >= 0x0590 && cp <= 0x05ff) return "Hebrew";
  if (cp >= 0x3000 && cp <= 0x303f) return "CJK Punctuation";
  if (cp >= 0xff00 && cp <= 0xff0f) return "Fullwidth Punctuation";
  return "Other";
}

/* Scripts that have no Latin look-alikes. Text written entirely in these
   is not suspicious merely for being non-ASCII. */
const NO_LATIN_LOOKALIKE = new Set([
  "CJK Unified Ideographs", "Hiragana", "Katakana", "Hangul",
  "Devanagari", "Thai", "Hebrew", "CJK Punctuation",
]);

function utf8Bytes(ch) {
  return Array.from(new TextEncoder().encode(ch)).map((b) => b.toString(16).padStart(2, "0"));
}

function isCombining(ch) {
  // Unicode general category Mn (nonspacing mark)
  return /\p{M}/u.test(ch);
}

function classify(ch) {
  const cp = ch.codePointAt(0);

  if (INVISIBLE[cp]) return { kind: "invisible", note: INVISIBLE[cp] };
  if (isCombining(ch)) return { kind: "combining", note: "combining mark (stacks on previous letter)" };
  if (CONFUSABLE[ch]) return { kind: "homoglyph", note: `looks like "${CONFUSABLE[ch]}"` };
  if (cp < 128) {
    if (ch === " ") return { kind: "ascii", note: "space" };
    if (ch === "\n") return { kind: "ascii", note: "newline" };
    if (ch === "\t") return { kind: "ascii", note: "tab" };
    if (cp < 32) return { kind: "control", note: "ASCII control character" };
    return { kind: "ascii", note: "plain ASCII" };
  }
  return { kind: "nonascii", note: scriptOf(cp) + " character" };
}

function analyze(text) {
  const chars = Array.from(text);
  const rows = chars.map((ch, i) => {
    const cp = ch.codePointAt(0);
    const c = classify(ch);
    return {
      index: i,
      ch,
      cp,
      hex: "U+" + cp.toString(16).toUpperCase().padStart(4, "0"),
      dec: cp,
      bytes: utf8Bytes(ch).join(" "),
      byteLen: utf8Bytes(ch).length,
      kind: c.kind,
      note: c.note,
      latin: CONFUSABLE[ch] || null,
    };
  });

  const counts = {
    total: chars.length,
    ascii: rows.filter((r) => r.cp < 128).length,
    nonascii: rows.filter((r) => r.cp >= 128).length,
    invisible: rows.filter((r) => r.kind === "invisible").length,
    homoglyph: rows.filter((r) => r.kind === "homoglyph").length,
    combining: rows.filter((r) => r.kind === "combining").length,
    control: rows.filter((r) => r.kind === "control").length,
    visible: chars.filter((c) => c.codePointAt(0) >= 32 && !INVISIBLE[c.codePointAt(0)]).length,
    bytes: new TextEncoder().encode(text).length,
  };

  /* Substitution regularity: for each Latin letter that has a look-alike,
     compare how many survived vs how many were replaced. A human typo is
     inconsistent; a generator is 100% consistent. */
  const classes = {};
  for (const [uni, lat] of Object.entries(CONFUSABLE)) {
    const key = lat.toLowerCase();
    classes[key] = classes[key] || { original: 0, replaced: 0, variants: new Set() };
  }
  for (const r of rows) {
    if (r.kind === "homoglyph") {
      const key = r.latin.toLowerCase();
      classes[key].replaced++;
      classes[key].variants.add(r.hex);
    } else if (r.cp < 128 && /[a-zA-Z]/.test(r.ch)) {
      const key = r.ch.toLowerCase();
      if (classes[key]) classes[key].original++;
    }
  }
  const regularity = Object.entries(classes)
    .filter(([, v]) => v.replaced > 0)
    .map(([lat, v]) => ({
      letter: lat,
      original: v.original,
      replaced: v.replaced,
      rate: v.replaced / (v.original + v.replaced),
      variants: [...v.variants],
    }))
    .sort((a, b) => b.replaced - a.replaced);

  let maxRate = regularity.length ? Math.max(...regularity.map((r) => r.rate)) : 0;

  /* SMS transport metadata */
  const gsm7 = chars.every((c) => GSM7_BASIC.includes(c) || GSM7_EXT.includes(c));
  const sms = {
    encoding: gsm7 ? "GSM-7" : "UCS-2 (16-bit)",
    charsPerSegment: gsm7 ? 160 : 70,
    segments: text.length === 0 ? 0 : Math.ceil(text.length / (gsm7 ? 160 : 70)),
    note: gsm7
      ? "Fits the GSM-7 basic charset — normal SMS."
      : "Contains characters outside GSM-7, so the carrier must switch to UCS-2. Segment size drops from 160 to 70 characters.",
  };

  /* Script census. A genuine foreign-language sentence uses letters that
     have no Latin twin. An attack sentence is a Latin skeleton with
     look-alikes sprinkled into it. */
  const LOOKALIKE_SCRIPTS = ["Cyrillic", "Greek", "Fullwidth Latin",
    "Phonetic Extensions", "Letterlike Symbols", "Mathematical Alphanumeric"];

  const scripts = {};
  for (const r of rows) {
    if (r.cp >= 128) {
      const s = scriptOf(r.cp);
      scripts[s] = (scripts[s] || 0) + 1;
    }
  }

  const foreignNonConfusable = rows.filter((r) =>
    r.cp >= 128 && !CONFUSABLE[r.ch] && !INVISIBLE[r.cp] &&
    !isCombining(r.ch) && LOOKALIKE_SCRIPTS.includes(scriptOf(r.cp))
  ).length;

  /* Strongest single signal: one word that contains both Latin letters
     and look-alike letters. Real Russian, Greek, or Chinese text does
     not do this. */
  const words = text.split(/[\s.,!?;:"'()]+/).filter((w) => w.length > 0);
  const mixedWords = words.filter((w) =>
    /[A-Za-z]/.test(w) && /[\u0400-\u047F\u0370-\u03FF]/.test(w)
  );

  const isForeignText = foreignNonConfusable >= 3 && mixedWords.length === 0;

  if (isForeignText) {
    for (const r of rows) {
      if (r.kind === "homoglyph") {
        r.kind = "script";
        r.note = scriptOf(r.cp) + " letter (part of a real foreign-language word)";
      }
    }
    counts.homoglyph = rows.filter((r) => r.kind === "homoglyph").length;
    maxRate = 0;
  }

  /* Risk score */
  let score = 0;
  if (counts.invisible > 0) score += 45;
  if (counts.homoglyph > 0) score += 35;
  if (maxRate >= 0.9) score += 20;
  if (mixedWords.length > 0) score += 25;
  if (counts.combining > 0) score += 15;
  if (counts.control > 0) score += 10;
  score = Math.min(100, score);

  const verdict =
    score === 0 ? (counts.nonascii > 0 ? "CLEAN (non-Latin script)" : "CLEAN") :
    score < 40 ? "SUSPICIOUS" :
    score < 75 ? "LIKELY MANIPULATED" :
    "MACHINE-GENERATED PAYLOAD";

  const cleaned = chars
    .filter((c) => !INVISIBLE[c.codePointAt(0)])
    .map((c) => CONFUSABLE[c] || c)
    .join("");

  return {
    rows, counts, regularity, sms, score, verdict, cleaned, maxRate,
    scripts, mixedWords, foreignNonConfusable, isForeignText,
  };
}

/* Red-team payload generators (for testing your own service's filters) */
function homoglyphVariant(text) {
  const reverse = {
    i: "і", I: "І", o: "о", O: "О", a: "а", A: "А", e: "е", E: "Е",
    c: "с", C: "С", p: "р", P: "Р", x: "х", X: "Х", t: "т", y: "у", s: "ѕ",
  };
  return Array.from(text).map((c) => reverse[c] || c).join("");
}

function zeroWidthVariant(text) {
  const out = [];
  for (const c of text) {
    out.push(c);
    if (/[a-zA-Z]/.test(c)) out.push("\u200B");
  }
  return out.join("");
}

function combiningVariant(text) {
  return Array.from(text).map((c) => (/[a-zA-Z]/.test(c) ? c + "\u0301" : c)).join("");
}

function fullwidthVariant(text) {
  return Array.from(text).map((c) => {
    const cp = c.codePointAt(0);
    if (cp >= 33 && cp <= 126) return String.fromCodePoint(cp + 0xFF00 - 0x20);
    return c;
  }).join("");
}

if (typeof module !== "undefined") module.exports = { analyze, homoglyphVariant, zeroWidthVariant, combiningVariant, fullwidthVariant };
