/**
 * Supplier Configuration
 * 
 * Mapping informasi supplier berdasarkan nama CV yang ada di kolom SUPPLIER pada Excel
 */

export interface SupplierConfig {
    name: string
    displayName: string
    themeColor: string
    bankAccount: string
    bankName: string
    address?: string
    category?: string
    // Account numbers this supplier used to have before a change — some
    // sheets (esp. ones without a supplier name per row, only a NO REK line)
    // still reference the old number and need to keep resolving correctly.
    legacyBankAccounts?: string[]
}

export const supplierMapping: Record<string, SupplierConfig> = {
    'PT JAYAMEN GROUP MANDIRI': {
        name: 'PT JAYAMEN GROUP MANDIRI',
        displayName: 'PT JAYAMEN GROUP MANDIRI',
        themeColor: '#84CC16', // Lime green
        bankAccount: '2106881961',
        bankName: 'BNI',
        address: 'Jl. Puteran Lesmana RT 003 RW 011 Desa/Kelurahan Lesmana, Kec. Ajibarang, Kab. Banyumas, Jawa Tengah 53163',
        category: 'SEMBAKO',
    },
    'UMKM UNDI YUWONO': {
        name: 'UMKM UNDI YUWONO',
        displayName: 'UMKM UNDI YUWONO',
        themeColor: '#71717A', // Neutral gray
        bankAccount: '2109717169',
        legacyBankAccounts: ['0330250705'],
        bankName: 'BNI',
        address: 'Darmakradenan Ajibarang',
        category: 'BUAH',
    },
    'NUSANTARA FOOD': {
        name: 'NUSANTARA FOOD',
        displayName: 'NUSANTARA FOOD',
        themeColor: '#7C3F73', // Purple
        bankAccount: '2106821810',
        bankName: 'BNI',
        address: 'Cihonje, RT 002/012 Desa/Kelurahan Cihonje, Kec. Gumelar, Kab. Banyumas, Jawa Tengah 53165',
        category: 'SAYUR & PROTEIN',
    },
    // Sama persis dengan NUSANTARA FOOD (rekening & pemilik sama) — beberapa
    // sheet Excel nulis nama pemilik rekening ini, bukan nama perusahaannya.
    // Pakai template Nusantara Food (ungu) juga, cuma nama di bawah ttd beda.
    'SUSILO WIDYONO': {
        name: 'SUSILO WIDYONO',
        displayName: 'SUSILO WIDYONO',
        themeColor: '#7C3F73', // Purple, sama seperti Nusantara Food
        bankAccount: '2106821810',
        bankName: 'BNI',
        address: 'Cihonje, RT 002/012 Desa/Kelurahan Cihonje, Kec. Gumelar, Kab. Banyumas, Jawa Tengah 53165',
        category: 'SAYUR & PROTEIN',
    },
    'SRI KARYA MUKTI': {
        name: 'SRI KARYA MUKTI',
        displayName: 'SRI KARYA MUKTI',
        themeColor: '#EA580C', // Orange
        bankAccount: '2003608397',
        bankName: 'BNI',
        address: 'Cihonje RT 3 RW 11, Desa/Kelurahan Cihonje, Kec. Gumelar, Kab. Banyumas, Provinsi Jawa Tengah. Kode Pos 53165',
    },
    'UD HIDAYAT': {
        name: 'UD HIDAYAT',
        displayName: 'UD HIDAYAT',
        themeColor: '#0284C7', // Sky Blue
        bankAccount: '6419855552',
        legacyBankAccounts: ['2051544265'],
        bankName: 'BNI',
        address: 'RT 03/RW 06, Desa Karang Lewas Kidul, Desa/Kelurahan Karanglewas Kidul, Kec. Karanglewas, Kab. Banyumas, Jawa Tengah. Kode Pos : 53161',
    },
}

/**
 * Helper function untuk mendapatkan config supplier berdasarkan nama
 * Support format: "PT JAYAMEN GROUP MANDIRI", "2106881961 BNI", atau nomor rekening saja
 */
export function getSupplierConfig(supplierName: string): SupplierConfig | null {
    // Normalize supplier name (trim and uppercase)
    const normalized = supplierName.trim().toUpperCase()

    // Try exact match first (untuk "PT JAYAMEN GROUP MANDIRI" format)
    if (supplierMapping[normalized]) {
        return supplierMapping[normalized]
    }

    // Legacy: sheet Excel lama masih bisa pakai nama lama "CV JAYAMEN"/"JAYAMEN"/
    // "UMKM PURWOTO" sebelum ganti nama jadi PT JAYAMEN GROUP MANDIRI
    if (normalized.includes('JAYAMEN') || normalized.includes('PURWOTO')) {
        return supplierMapping['PT JAYAMEN GROUP MANDIRI']
    }

    // Legacy: sheet Excel lama masih bisa pakai nama lama "CV SEKAR WIJAYAKUSUMA"
    // sebelum ganti nama jadi NUSANTARA FOOD
    if (normalized.includes('SEKAR') || normalized.includes('WIJAYAKUSUMA')) {
        return supplierMapping['NUSANTARA FOOD']
    }

    // "Waris Ika Pujian" adalah nama pemilik rekening Sri Karya Mukti (per
    // data resmi PT/UMKM), beberapa sheet Excel mungkin nulis nama ini
    if (normalized.includes('WARIS') || normalized.includes('PUJIAN')) {
        return supplierMapping['SRI KARYA MUKTI']
    }

    // Try to match by account number (untuk "0951810694 BNI" format)
    // Extract account number from supplier name
    const accountMatch = normalized.match(/^(\d+)/)
    if (accountMatch) {
        const accountNumber = accountMatch[1]
        // Compare numerically (not string-exact) so a leading zero Excel
        // silently drops when a "0330250705"-style account is stored as a
        // raw number ("330250705") still matches correctly.
        const accountNumeric = accountNumber.replace(/^0+/, '') || '0'
        for (const [key, config] of Object.entries(supplierMapping)) {
            const candidates = [config.bankAccount, ...(config.legacyBankAccounts || [])]
            if (candidates.some(acc => acc.replace(/^0+/, '') === accountNumeric)) {
                return config
            }
        }
    }

    // Try partial match (untuk backward compatibility)
    for (const key in supplierMapping) {
        if (normalized.includes(key.toUpperCase()) || key.toUpperCase().includes(normalized)) {
            return supplierMapping[key]
        }
    }

    return null
}

/**
 * List semua supplier yang tersedia
 */
export function getAllSuppliers(): SupplierConfig[] {
    return Object.values(supplierMapping)
}
