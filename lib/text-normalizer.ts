/**
 * Text normalization for invoice item names (URAIAN column from Excel).
 *
 * Rules (per user spec, formal Indonesian):
 *   - Apply Title Case word-by-word.
 *   - Expand abbreviations: "Gr"/"500gr" → "500 Gram", "lt"/"2lt" → "2 L".
 *   - Insert space between number and unit: "650ml" → "650 ml", "500gr" → "500 gram".
 *   - Replace standalone "non" with "tidak" (e.g. "Bawang Putih Non Kupas" → "Bawang Putih Tidak Kupas").
 *   - Wrap trailing quantity descriptors with "isi N" in parentheses
 *     (e.g. "Ayam Parting 1 kg isi 10" → "Ayam Parting (1 kg isi 10)").
 *   - Preserve known acronyms in uppercase (UHT, IR, BNI, ABC, CV, UMKM, SPPG).
 *   - Inside parentheses keep formatting lowercase except liter ("L") which is always uppercase
 *     to avoid confusion with the digit "1".
 */

// Units that should appear lowercase outside parens (formal Indonesian convention),
// except "L" which is uppercase to disambiguate from digit "1".
const UNITS_LOWERCASE: Record<string, string> = {
    'ml': 'ml',
    'kg': 'kg',
    'gram': 'gram',
    'gr': 'gram',
    'liter': 'liter',
    'pcs': 'pcs',
    'btl': 'btl',
    'krat': 'krat',
    'pack': 'pack',
    'pak': 'pak',
    'bks': 'bks',
    'bal': 'bal',
    'iket': 'iket',
    'ikat': 'ikat',
    'rcng': 'rcng',
    'renceng': 'renceng',
    'pouch': 'pouch',
    'sachet': 'sachet',
    'kaleng': 'kaleng',
    'galon': 'galon',
    'ons': 'ons',
    'butir': 'butir',
    'buah': 'buah',
    'biji': 'biji',
    'batang': 'batang',
    'lembar': 'lembar',
    'helai': 'helai',
    'ekor': 'ekor',
    'bungkus': 'bungkus',
    'botol': 'botol',
    'dus': 'dus',
    'karung': 'karung',
    'lonjor': 'lonjor',
}

const UNIT_LITER = 'L'

// Regex alternation group of all unit tokens, plus standalone "l" for liter.
// Used in digit-spacing (step 4) and isi-N descriptor wrap (step 5).
const UNIT_PATTERN = [...Object.keys(UNITS_LOWERCASE), 'l'].join('|')

// Acronyms that should always be uppercase regardless of context.
const ACRONYMS_UPPERCASE: Record<string, string> = {
    'uht': 'UHT',
    'ir': 'IR',
    'bni': 'BNI',
    'bca': 'BCA',
    'abc': 'ABC',
    'cv': 'CV',
    'umkm': 'UMKM',
    'sppg': 'SPPG',
    'pt': 'PT',
    'skm': 'SKM',
}

// Words that mark a LEGITIMATE "tidak X" form descriptor (preserved as part of
// the item name). Anything else after "tidak" is treated as a noise quality
// requirement and stripped.
//
// Examples:
//   "Bawang Putih Tidak Kupas" → kept (kupas IS in safelist — "not peeled"
//                                    is a real product form)
//   "Wortel Tidak Tua"         → stripped (tua not in safelist — quality note)
//   "Buah Naga, Tidak Bonyok"  → stripped (bonyok not in safelist)
const LEGIT_TIDAK_WORDS = new Set([
    'kupas', 'dikupas', 'kupasan',
])

// Standalone quality words that on their own indicate a noise note.
const NOISE_STANDALONE_WORDS = new Set([
    'bagus', 'matang', 'manis', 'segar', 'baik', 'fresh',
])

// Vocabulary normalization: colloquial Indonesian → formal Indonesian.
// Applied as whole-word replacements, case-insensitive.
const VOCAB_NORMALIZE: Array<[RegExp, string]> = [
    [/\bcabe\b/gi, 'cabai'],
    [/\bijo\b/gi, 'hijau'],
]

/**
 * Decide if a single segment (separated by comma, or inside parens) is a noise
 * note that should be discarded.
 *   true  → discard (quality requirement, packaging instruction, etc.)
 *   false → keep (item name part, quantity descriptor, brand, etc.)
 */
function isNoiseSegment(segment: string): boolean {
    const lower = segment.trim().toLowerCase()
    if (!lower) return true

    // "tidak <word>" — noise UNLESS <word> is in the legit safelist
    // (e.g. "tidak kupas" stays, "tidak tua/bonyok/busuk/..." dropped)
    const tidakMatch = lower.match(/^tidak\s+(\w+)/)
    if (tidakMatch && !LEGIT_TIDAK_WORDS.has(tidakMatch[1])) return true

    // Packaging instructions: "pakai kresek bening", "pakai plastik"
    if (/^pakai\s+/.test(lower)) return true

    // Restrictions: "jangan terlalu tua"
    if (/^jangan\s+/.test(lower)) return true

    // Colloquial descriptors: "yang udah kuning", "yang sudah matang"
    if (/^yang\s+/.test(lower)) return true

    // Quality modifiers: "terlalu tua"
    if (/^terlalu\s+/.test(lower)) return true

    // Past-tense state descriptions: "sudah di sortir", "sudah bersih", "sudah dicuci"
    if (/^sudah\s+/.test(lower)) return true

    // Cleanliness instructions: "bersih dari akar", "bersih tanpa kotoran"
    if (/^bersih\s+(?:dari|tanpa)\s+/.test(lower)) return true

    // Color requirements: "warna hijau", "warna merah" — almost always a noise
    // descriptor in product names (real items just say "Cabai Merah" not
    // "Cabai Warna Merah")
    if (/^warna\s+/.test(lower)) return true

    // Compound: "daun warna hijau" — when "daun" is just a leaf-color descriptor
    if (/^daun\s+warna\s+/.test(lower)) return true

    // Standalone quality words
    if (NOISE_STANDALONE_WORDS.has(lower)) return true

    return false
}

/**
 * Strip noise notes (quality requirements, packaging instructions) from an
 * item name. Operates on:
 *   1. Content inside parentheses — filter noise segments; if all noise, drop the parens.
 *   2. Top-level comma-separated segments — keep first (main name), drop noise from rest.
 *   3. Inline "tidak <noise-word>" sequences without separators.
 *
 * Examples:
 *   "Buah Naga 1 kg Isi 2, Tidak Bonyok, Tidak Busuk, Tidak Boleng"
 *     → "Buah Naga 1 kg Isi 2"
 *   "Melon (bagus, tidak memar, manis, matang)"
 *     → "Melon"
 *   "Sayur Bayam (pakai kresek bening)"
 *     → "Sayur Bayam"
 *   "Bawang Putih Tidak Kupas"
 *     → "Bawang Putih Tidak Kupas"  (kupas is not a noise word)
 *   "Jeruk manis kuning tidak bonyok tidak busuk 1kg isi 11"
 *     → "Jeruk manis kuning 1kg isi 11"
 */
function stripNoiseNotes(s: string): string {
    // 1. Filter noise inside parentheses
    s = s.replace(/\(([^)]*)\)/g, (_match, inner: string) => {
        const segments = inner.split(',').map(seg => seg.trim())
        const kept = segments.filter(seg => !isNoiseSegment(seg))
        if (kept.length === 0) return ' '
        return `(${kept.join(', ')})`
    })

    // 2. Filter top-level comma-separated segments (keep first as main name)
    const parts = s.split(',').map(seg => seg.trim()).filter(p => p.length > 0)
    if (parts.length > 1) {
        const kept = [parts[0]]
        for (let i = 1; i < parts.length; i++) {
            if (!isNoiseSegment(parts[i])) kept.push(parts[i])
        }
        s = kept.join(', ')
    } else if (parts.length === 1) {
        s = parts[0]
    }

    // 3. Strip inline "tidak <word>" sequences UNLESS the word is in the
    //    legit safelist. So "Wortel Tidak Tua" → "Wortel" (tua dropped),
    //    but "Bawang Putih Tidak Kupas" stays as-is.
    s = s.replace(/\btidak\s+(\w+)\b/gi, (match, word: string) => {
        return LEGIT_TIDAK_WORDS.has(word.toLowerCase()) ? match : ''
    })

    // 4. Strip inline "yang ..." descriptors that trail at end-of-string, before
    //    comma, or before opening paren. Matches "yang X", "yang X Y", "yang X Y Z"
    //    (up to 3 words after "yang"). Uses [^\s()] instead of \S so it doesn't
    //    eat parenthesized quantity descriptors like "(1 ikat)".
    //    Examples:
    //      "Jeruk Manis Yang Udah Kuning"      → "Jeruk Manis"
    //      "Pisang Yang Sudah Matang"          → "Pisang"
    //      "Bayam Yang Bersih (1 ikat)"        → "Bayam (1 ikat)"
    s = s.replace(/\s+yang\s+[^\s()]+(?:\s+[^\s()]+){0,2}(?=\s*(?:,|\(|$))/gi, '')

    // 4b. Strip other inline noise phrases. "[^,()]*" greedily eats everything
    //     up to the next comma/paren/end-of-string so the entire descriptor
    //     gets removed in one shot. Order matters: "daun warna ..." runs
    //     first so it consumes "Daun" before the standalone "warna" pattern
    //     would leave it stranded.
    s = s.replace(/\s+daun\s+warna\b[^,()]*/gi, '')          // "Daun Warna Hijau ..."
    s = s.replace(/\s+sudah\b[^,()]*/gi, '')                 // "Sudah di sortir", "Sudah bersih ..."
    s = s.replace(/\s+bersih\s+(?:dari|tanpa)\b[^,()]*/gi, '') // "Bersih dari Akar"
    s = s.replace(/\s+warna\s+\w+(?:\s+[^,()]*)?/gi, '')     // "Warna Hijau ..."

    // 5. Cleanup: collapse whitespace and trim trailing punctuation
    s = s.replace(/\s+/g, ' ').trim()
    s = s.replace(/[,.;:]+\s*$/, '').trim()

    return s
}

/**
 * Title-case a single word. Acronyms map to uppercase; other words get
 * leading-cap + rest-lowercase. Unit lowercasing is NOT done here — it's a
 * second pass in `applyCasing` that only fires when the unit follows a number.
 * That way "SKM Kaleng frisian" → "SKM Kaleng Frisian" (kaleng = noun)
 * but "200 kaleng" → "200 kaleng" (kaleng = unit).
 */
function titleCaseWordInitial(word: string): string {
    if (!word) return word
    const lower = word.toLowerCase()

    // Numbers stay as-is (incl. floats like "1.5", "2,5", "1/2")
    if (/^[\d.,/]+$/.test(word)) return word

    // Acronym lookup — always uppercase
    if (ACRONYMS_UPPERCASE[lower] !== undefined) return ACRONYMS_UPPERCASE[lower]

    // All-caps short tokens (≤3 chars) are likely abbreviations not in our map — preserve them
    const isAllUpper = word === word.toUpperCase() && /[A-Z]/.test(word)
    if (isAllUpper && word.length >= 2 && word.length <= 3) return word

    // Default: capitalize first letter, lowercase rest
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
}

/**
 * Apply title casing across a string, handling parenthesized segments separately:
 *   - Outside parens: title case each word, then lowercase units that follow a number.
 *   - Inside parens: lowercase everything (except liter "L"), since parens hold descriptors.
 */
function applyCasing(s: string): string {
    // Split keeping the parens groups as separate parts
    const parts = s.split(/(\([^)]*\))/)
    return parts.map(part => {
        if (part.startsWith('(') && part.endsWith(')')) {
            const inner = part.slice(1, -1).toLowerCase()
            // Capitalize standalone "L" (liter)
            const finalInner = inner.replace(/\bl\b/g, UNIT_LITER)
            return `(${finalInner})`
        }
        // First pass: title case all words
        let result = part.split(/(\s+)/).map(token => {
            if (/^\s+$/.test(token)) return token
            return titleCaseWordInitial(token)
        }).join('')

        // Second pass: lowercase units that follow a number ("500 Gram" → "500 gram")
        const unitsAlt = Object.keys(UNITS_LOWERCASE).join('|')
        const numUnit = new RegExp(`(\\d+(?:[.,]\\d+)?)\\s+(${unitsAlt})\\b`, 'gi')
        result = result.replace(numUnit, (_, num, unit) => `${num} ${unit.toLowerCase()}`)

        // Liter is always uppercase L when following a number
        result = result.replace(/(\d+(?:[.,]\d+)?)\s+l\b/gi, (_, num) => `${num} ${UNIT_LITER}`)

        return result
    }).join('')
}

/**
 * Normalize an item name string per the rules documented at the top of this file.
 * Idempotent: passing already-normalized text should produce the same output.
 */
export function normalizeItemName(raw: string): string {
    if (!raw) return raw
    let s = raw.trim()
    if (!s) return s

    // 0. Strip "@" symbol entirely. Used as "each/per" marker in lists like
    //    "1 pack isi @24 pcs" — we drop it because the meaning is already
    //    conveyed by "isi". Whitespace is normalized in the final cleanup.
    s = s.replace(/@/g, '')

    // 1. Replace "non" with "tidak":
    //    - Standalone: "Bawang Putih Non Kupas" → "Bawang Putih Tidak Kupas"
    //    - Attached typo: "Bawang Merah Nonkupas" → "Bawang Merah tidak kupas"
    //    Done first so any "non bonyok" gets normalized to "tidak bonyok" before
    //    the noise-stripping step below picks it up.
    s = s.replace(/\bnon([a-z]+)\b/gi, 'tidak $1')
    s = s.replace(/\bnon\b/gi, 'tidak')

    // 1b. Vocabulary normalization (colloquial → formal Indonesian).
    //    "cabe" → "cabai", "ijo" → "hijau", etc.
    for (const [pattern, replacement] of VOCAB_NORMALIZE) {
        s = s.replace(pattern, replacement)
    }

    // 1c. Strip noise notes (quality requirements, packaging instructions).
    s = stripNoiseNotes(s)

    // 2. Expand "Gr" / "500gr" → "Gram" / "500 gram"
    //    (handle attached form first to also insert the space)
    s = s.replace(/(\d+(?:[.,]\d+)?)\s*gr\b(?!am)/gi, '$1 gram')
    s = s.replace(/\bgr\b(?!am)/gi, 'gram')

    // 3. Expand "lt" / "2lt" → "L" / "2 L"
    s = s.replace(/(\d+(?:[.,]\d+)?)\s*lt\b/gi, '$1 L')
    s = s.replace(/\blt\b/gi, 'L')

    // 4. Insert space between number and common attached units:
    //    "650ml" → "650 ml", "500gram" → "500 gram", "2kg" → "2 kg", "1L" → "1 L"
    s = s.replace(new RegExp(`(\\d+(?:[.,]\\d+)?)(${UNIT_PATTERN})\\b`, 'gi'), '$1 $2')
    //    Standalone "L" attached to digit ("2L", but not "abcL")
    s = s.replace(/(\d+(?:[.,]\d+)?)L\b/g, '$1 L')

    // 5. If string has no parentheses, detect a trailing quantity descriptor and
    //    wrap it. Supports patterns:
    //      "<num> [<unit>?] isi <num> [<unit>?]"
    //    Examples that match:
    //      "Ayam Parting 1 kg isi 10"            → "Ayam Parting (1 kg isi 10)"
    //      "Saos Tomat 1 pack isi 24 pcs"        → "Saos Tomat (1 pack isi 24 pcs)"
    //      "Telur 1 krat isi 30 butir"           → "Telur (1 krat isi 30 butir)"
    if (!/[()]/.test(s)) {
        const isiRe = new RegExp(
            `^(.+?)\\s+(\\d+(?:[.,]\\d+)?\\s*(?:${UNIT_PATTERN})?\\s+isi\\s+\\d+(?:[.,]\\d+)?(?:\\s+(?:${UNIT_PATTERN}))?)\\s*$`,
            'i'
        )
        s = s.replace(isiRe, '$1 ($2)')
    }

    // 6. Apply final casing (title case outside parens, lowercase inside)
    s = applyCasing(s)

    // 7. Collapse any double spaces left over from earlier replacements
    s = s.replace(/\s+/g, ' ').trim()

    return s
}

/**
 * Extract the SPPG short name from a workbook filename.
 *
 * Examples:
 *   "RAB SPPG Tambak (3).xlsx" → "Tambak"
 *   "SPPG Pandansari.xlsx"      → "Pandansari"
 *   "RAB SPPG Tambak Selatan.xlsx" → "Tambak Selatan"
 *   "anything-else.xlsx"        → undefined
 */
export function extractSppgNameFromFilename(filename: string): string | undefined {
    if (!filename) return undefined
    // Strip extension
    const stem = filename.replace(/\.[^.]+$/, '')
    // Match "SPPG " followed by capitalized word(s), stopping at a paren / digit / end
    const m = stem.match(/SPPG\s+([A-Za-z][A-Za-z\s]*?)(?=\s*[(\d]|$)/i)
    if (!m) return undefined
    const raw = m[1].trim()
    if (!raw) return undefined
    // Title-case each word in the SPPG name for consistency
    return raw.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
}
