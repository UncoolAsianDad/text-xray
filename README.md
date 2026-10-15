# text-xray

Live demo: https://uncoolasiandad.github.io/text-xray/

A dependency-free, offline webpage for inspecting SMS and chat payloads for
hidden or fake characters: homoglyphs, zero-width characters, bidi controls,
and combining marks.

Author: Brian Ho (brian@codeforart.com)

## Run it

```bash
cd ~/Projects/security/text-xray
python3 -m http.server 8090
# then open http://localhost:8090
```

Or just open `index.html` directly in a browser. Everything runs client-side;
nothing is sent anywhere.

## What it does

1. **X-ray view** — renders the text with every hidden character drawn as a
   visible marker, annotated with its codepoint.
2. **Cleaned text** — the normalized ASCII version a filter should compare
   against.
3. **Substitution regularity** — per-letter table of "real vs replaced".
   A 100% replacement rate is a machine signature; humans typo inconsistently.
4. **SMS transport** — GSM-7 vs UCS-2, segment count. Invisible characters
   force UCS-2, which halves segment size. Free signal at the gateway.
5. **Character table** — every character with codepoint, decimal, UTF-8 bytes,
   and verdict.
6. **Payload generator** — produces homoglyph / zero-width / combining /
   fullwidth variants of your own text so you can test your filters.

## Use from Node

```js
const { analyze, homoglyphVariant, zeroWidthVariant } = require("./xray.js");

const a = analyze("Іs thіs stіll yоu?");
console.log(a.verdict, a.score, a.counts, a.regularity, a.cleaned);
```

## Key facts encoded in the tool

- ASCII is only U+0000–U+007F. Anything above is not an English letter, even
  if it renders identically.
- `NFKC` normalization does **not** fix homoglyphs. Cyrillic `о` (U+043E) is
  not a variant of Latin `o` (U+006F); it is a different letter. Use the
  Unicode Confusables table (UTR#39).
- Zero-width characters (U+200B, U+200C, U+200D, U+FEFF) split words invisibly
  and break `\b` word-boundary regex.
- Non-ASCII alone is not evidence of an attack. Guilt comes from
  **mixed script + 100% regular substitution**.
