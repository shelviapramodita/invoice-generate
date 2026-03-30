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
}

export const supplierMapping: Record<string, SupplierConfig> = {
    'CV JAYAMEN': {
        name: 'CV JAYAMEN',
        displayName: 'CV JAYAMEN',
        themeColor: '#84CC16', // Lime green
        bankAccount: '0951810694',
        bankName: 'BNI',
        address: 'Ajibarang',
        category: 'SEMBAKO',
    },
    'UMKM UNDI YUWONO': {
        name: 'UMKM UNDI YUWONO',
        displayName: 'UMKM UNDI YUWONO',
        themeColor: '#71717A', // Neutral gray
        bankAccount: '0330250705',
        bankName: 'BNI',
        address: 'Darmakradenan Ajibarang',
        category: 'BUAH',
    },
    'CV SEKAR WIJAYAKUSUMA': {
        name: 'CV SEKAR WIJAYAKUSUMA',
        displayName: 'CV SEKAR WIJAYAKUSUMA',
        themeColor: '#DC2626', // Red
        bankAccount: '0291155789',
        bankName: 'BNI',
        address: 'Dsun.K1, 001/008, RT.012, Kwitang, Gemeter, Kab. Banyumas',
        category: 'SAYUR & PROTEIN',
    },
}

/**
 * Helper function untuk mendapatkan config supplier berdasarkan nama
 * Support format: "CV JAYAMEN", "0951810694 BNI", atau nomor rekening saja
 */
export function getSupplierConfig(supplierName: string): SupplierConfig | null {
    // Normalize supplier name (trim and uppercase)
    const normalized = supplierName.trim().toUpperCase()

    // Try exact match first (untuk "CV JAYAMEN" format)
    if (supplierMapping[normalized]) {
        return supplierMapping[normalized]
    }

    // Try to match by account number (untuk "0951810694 BNI" format)
    // Extract account number from supplier name
    const accountMatch = normalized.match(/^(\d+)/)
    if (accountMatch) {
        const accountNumber = accountMatch[1]
        // Find supplier with matching bank account
        for (const [key, config] of Object.entries(supplierMapping)) {
            if (config.bankAccount === accountNumber) {
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
