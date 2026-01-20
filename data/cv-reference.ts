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
        bankAccount: '0951810094',
        bankName: 'BNI',
        address: 'Ajibarang',
        category: 'SEMBAKO',
    },
    'UMKM UNDI YUWONO': {
        name: 'UMKM UNDI YUWONO',
        displayName: 'UMKM UNDI YUWONO',
        themeColor: '#71717A', // Neutral gray
        bankAccount: '330250705',
        bankName: 'BNI',
        address: 'Darmakradenan Ajibarang',
        category: 'BUAH',
    },
    'CV SEKAR WIJAYAKUSUMA': {
        name: 'CV SEKAR WIJAYAKUSUMA',
        displayName: 'CV SEKAR WIJAYAKUSUMA',
        themeColor: '#DC2626', // Red
        bankAccount: '291155789',
        bankName: 'BNI',
        address: 'Dsun.K1, 001/008, RT.012, Kwitang, Gemeter, Kab. Banyumas',
        category: 'SAYUR & PROTEIN',
    },
}

/**
 * Helper function untuk mendapatkan config supplier berdasarkan nama
 */
export function getSupplierConfig(supplierName: string): SupplierConfig | null {
    // Normalize supplier name (trim and uppercase)
    const normalized = supplierName.trim().toUpperCase()

    // Try exact match first
    if (supplierMapping[normalized]) {
        return supplierMapping[normalized]
    }

    // Try partial match
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
