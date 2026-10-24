import type { InvoiceItemForm } from '@/types'
import type { InvoiceDocType } from '../doc-variant'
import type { SupplierTemplateKey } from '../utils'
import { JayamenTemplate } from './jayamen-template'
import { UndiYuwonoTemplate } from './undi-yuwono-template'
import { SekarWijayakusumaTemplate } from './sekar-wijayakusuma-template'
import { SriKaryaMuktiTemplate } from './sri-karya-mukti-template'
import { UdHidayatTemplate } from './ud-hidayat-template'

export interface SupplierTemplateProps {
    invoiceNumber: string
    invoiceDate: Date
    items: InvoiceItemForm[]
    customerName?: string
    // undefined = TAGIHAN. Invoice lama customer biasa tetap FAKTUR (lihat resolveDocType)
    documentType?: InvoiceDocType
}

/**
 * Satu-satunya pemetaan supplier → template PDF. Dipakai saat generate awal
 * (pdf-generator) dan saat regenerate dari /history (PATCH /api/invoices/[id]).
 */
export function renderSupplierTemplate(key: SupplierTemplateKey, props: SupplierTemplateProps) {
    switch (key) {
        case 'jayamen':
            return JayamenTemplate(props)
        case 'undi-yuwono':
            return UndiYuwonoTemplate(props)
        case 'nusantara-food':
            return SekarWijayakusumaTemplate(props)
        case 'susilo-widyono':
            // Rekening & template sama persis dengan Nusantara Food, cuma nama
            // yang tercetak di bawah ttd yang beda
            return SekarWijayakusumaTemplate({ ...props, signatureName: 'SUSILO WIDYONO' })
        case 'sri-karya-mukti':
            return SriKaryaMuktiTemplate(props)
        case 'ud-hidayat':
            return UdHidayatTemplate(props)
    }
}
