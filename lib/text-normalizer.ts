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
    'rcng': 'rcng',
    'renceng': 'renceng',
    'pouch': 'pouch',
    'sachet': 'sachet',
    'kaleng': 'kaleng',
    'galon': 'galon',
    'ons': 'ons',
}

const UNIT_LITER = 'L'

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

    // 1. Replace standalone "non" with "tidak" (case-insensitive)
    s = s.replace(/\bnon\b/gi, 'tidak')

    // 2. Expand "Gr" / "500gr" → "Gram" / "500 gram"
    //    (handle attached form first to also insert the space)
    s = s.replace(/(\d+(?:[.,]\d+)?)\s*gr\b(?!am)/gi, '$1 gram')
    s = s.replace(/\bgr\b(?!am)/gi, 'gram')

    // 3. Expand "lt" / "2lt" → "L" / "2 L"
    s = s.replace(/(\d+(?:[.,]\d+)?)\s*lt\b/gi, '$1 L')
    s = s.replace(/\blt\b/gi, 'L')

    // 4. Insert space between number and common attached units:
    //    "650ml" → "650 ml", "500gram" → "500 gram", "2kg" → "2 kg", "1L" → "1 L"
    s = s.replace(/(\d+(?:[.,]\d+)?)(kg|ml|liter|gram|pcs|btl|krat|pack|bks|bal|iket|sachet|kaleng|galon|pouch|ons)\b/gi, '$1 $2')
    //    Standalone "L" attached to digit ("2L", but not "abcL")
    s = s.replace(/(\d+(?:[.,]\d+)?)L\b/g, '$1 L')

    // 5. If string has no parentheses, detect a trailing "isi N" descriptor and wrap it.
    //    Pattern: "<name>" + space + "[<num> <unit>?]? isi <num>" at end of string.
    if (!/[()]/.test(s)) {
        s = s.replace(
            /^(.+?)\s+((?:\d+(?:[.,]\d+)?\s*(?:kg|gram|ml|l|liter|pcs|btl)\s+)?isi\s+\d+(?:[.,]\d+)?)\s*$/i,
            '$1 ($2)'
        )
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
