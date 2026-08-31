import { pdf } from '@react-pdf/renderer'
import JSZip from 'jszip'
import { format } from 'date-fns'
import { ParsedExcelData, InvoiceItemForm, InvoiceSummary } from '@/types'
import { getNextInvoiceNumber } from './utils'
import { JayamenTemplate } from './templates/jayamen-template'
import { UndiYuwonoTemplate } from './templates/undi-yuwono-template'
import { SekarWijayakusumaTemplate } from './templates/sekar-wijayakusuma-template'
import { SriKaryaMuktiTemplate } from './templates/sri-karya-mukti-template'
import { UdHidayatTemplate } from './templates/ud-hidayat-template'

// Helper to sanitize filename (remove/replace invalid characters)
function sanitizeFilename(name: string): string {
    return name
        .replace(/[\/\\:*?"<>|]/g, '-')  // Replace invalid chars with dash
        .replace(/\s+/g, ' ')             // Normalize spaces
        .trim()
}

export interface PDFGenerationOptions {
    invoiceDate: Date
    batchName?: string
    customerName?: string
    customerNames?: Record<string, string>
    invoiceNumbers?: Record<string, string>
}

export interface GeneratedPDF {
    supplier: string
    blob: Blob
    invoiceNumber: string
    // Optional label identifying which day/batch this PDF belongs to (e.g. "21-01-2026").
    // Used by preview sidebar and ZIP folder grouping when generating across multiple days.
    groupLabel?: string
    // The Nama Batch the user configured for this PDF's day (e.g.
    // "Kwitansi SPPG Tambak - 28/04/2026"). Used as folder name in ZIPs and
    // filename prefix for single-PDF downloads so the user gets neat,
    // consistent file naming that matches what they typed in the UI.
    batchName?: string
}

/**
 * Generate PDF for a specific supplier based on supplier name
 */
async function generatePDFForSupplier(
    supplier: string,
    items: InvoiceItemForm[],
    options: PDFGenerationOptions,
    customInvoiceNumber?: string
): Promise<GeneratedPDF> {
    const invoiceNumber = customInvoiceNumber || getNextInvoiceNumber()
    const { invoiceDate, customerName, customerNames } = options
    
    // Use per-supplier customerName if available, otherwise use global customerName
    const supplierCustomerName = customerNames?.[supplier] || customerName

    let template

    // Select appropriate template based on supplier
    if (supplier.includes('JAYAMEN') || supplier.includes('PURWOTO')) {
        template = JayamenTemplate({
            invoiceNumber,
            invoiceDate,
            items,
            customerName: supplierCustomerName,
        })
    } else if (supplier.includes('UNDI') || supplier.includes('YUWONO')) {
        template = UndiYuwonoTemplate({
            invoiceNumber,
            invoiceDate,
            items,
            customerName: supplierCustomerName,
        })
    } else if (supplier.includes('SEKAR') || supplier.includes('WIJAYAKUSUMA')) {
        template = SekarWijayakusumaTemplate({
            invoiceNumber,
            invoiceDate,
            items,
            customerName: supplierCustomerName,
        })
    } else if (supplier.includes('WIDYONO') || supplier.includes('WIDIYONO')) {
        // Sama seperti CV Sekar Wijayakusuma (rekening & template sama persis),
        // cuma nama yang tercetak di bawah ttd yang beda
        template = SekarWijayakusumaTemplate({
            invoiceNumber,
            invoiceDate,
            items,
            customerName: supplierCustomerName,
            signatureName: 'SUSILO WIDYONO',
        })
    } else if (supplier.includes('SRI') || supplier.includes('KARYA MUKTI')) {
        template = SriKaryaMuktiTemplate({
            invoiceNumber,
            invoiceDate,
            items,
            customerName: supplierCustomerName,
        })
    } else if (supplier.includes('HIDAYAT')) {
        template = UdHidayatTemplate({
            invoiceNumber,
            invoiceDate,
            items,
            customerName: supplierCustomerName,
        })
    } else {
        // Default to Jayamen template if supplier not recognized
        template = JayamenTemplate({
            invoiceNumber,
            invoiceDate,
            items,
            customerName: supplierCustomerName,
        })
    }

    // Generate PDF blob
    const blob = await pdf(template).toBlob()

    return {
        supplier,
        blob,
        invoiceNumber,
    }
}

/**
 * Generate PDFs for all suppliers from parsed Excel data
 * Returns array of PDF blobs with metadata
 */
export async function generateInvoicePDFs(
    parsedData: ParsedExcelData,
    options: PDFGenerationOptions
): Promise<GeneratedPDF[]> {
    const pdfs: GeneratedPDF[] = []

    // Generate PDF for each supplier
    for (const [supplier, items] of Object.entries(parsedData)) {
        if (items && items.length > 0) {
            const pdf = await generatePDFForSupplier(supplier, items, options)
            pdfs.push(pdf)
        }
    }

    return pdfs
}

/**
 * Generate PDFs with custom invoice numbers for each supplier
 */
export async function generateInvoicePDFsWithNumbers(
    parsedData: ParsedExcelData,
    options: PDFGenerationOptions
): Promise<GeneratedPDF[]> {
    const pdfs: GeneratedPDF[] = []
    const { invoiceNumbers = {} } = options

    // Generate PDF for each supplier with custom number
    for (const [supplier, items] of Object.entries(parsedData)) {
        if (items && items.length > 0) {
            const customNumber = invoiceNumbers[supplier]
            const pdf = await generatePDFForSupplier(supplier, items, options, customNumber)
            pdfs.push(pdf)
        }
    }

    return pdfs
}

/**
 * Download a single PDF
 * Uses file-saver for better cross-browser filename support (especially Safari/Arc)
 */
export function downloadPDF(blob: Blob, filename: string) {
    import('file-saver').then(({ saveAs }) => {
        saveAs(blob, filename)
    }).catch(() => {
        // Fallback to native method if file-saver fails
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = filename
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
    })
}

/**
 * Merge multiple PDFs into a single PDF file
 */
export async function mergePDFs(pdfs: GeneratedPDF[], filename: string): Promise<void> {
    const { PDFDocument } = await import('pdf-lib')

    // Create a new PDF document
    const mergedPdf = await PDFDocument.create()

    // Add each PDF to the merged document
    for (const pdf of pdfs) {
        const pdfBytes = await pdf.blob.arrayBuffer()
        const pdfDoc = await PDFDocument.load(pdfBytes)
        const copiedPages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices())
        copiedPages.forEach((page) => mergedPdf.addPage(page))
    }

    // Save the merged PDF
    const mergedPdfBytes = await mergedPdf.save()
    const mergedBlob = new Blob([mergedPdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' })

    // Download
    downloadPDF(mergedBlob, filename)
}

/**
 * Download all PDFs as separate files
 */
/**
 * Download multiple PDFs as a single ZIP file
 */
export async function downloadAsZip(pdfs: GeneratedPDF[], filename: string) {
    try {
        console.log('Creating ZIP file with', pdfs.length, 'PDFs')
        const JSZip = (await import('jszip')).default
        const zip = new JSZip()

        // If any PDF has a batchName/groupLabel, organize into folders so the ZIP
        // structure mirrors what the user configured. Prefer batchName (matches
        // "Nama Batch" the user typed) over generic groupLabel date.
        const hasGroups = pdfs.some(p => p.batchName || p.groupLabel)

        pdfs.forEach((pdf) => {
            const safeSupplier = sanitizeFilename(pdf.supplier)
            const safeInvoice = sanitizeFilename(pdf.invoiceNumber)
            const baseName = `${safeSupplier}-${safeInvoice}.pdf`
            if (hasGroups && (pdf.batchName || pdf.groupLabel)) {
                const folder = sanitizeFilename(pdf.batchName || pdf.groupLabel || '')
                zip.file(`${folder}/${baseName}`, pdf.blob)
            } else {
                zip.file(`Invoice-${baseName}`, pdf.blob)
            }
        })

        console.log('Generating ZIP blob...')
        // Generate zip blob
        const zipBlob = await zip.generateAsync({ type: 'blob' })

        console.log('Downloading ZIP:', filename)
        // Download zip
        downloadPDF(zipBlob, filename)
    } catch (error) {
        console.error('Error creating ZIP:', error)
        throw new Error('Gagal membuat file ZIP: ' + (error as Error).message)
    }
}

/**
 * Download all PDFs
 * If single PDF: download directly
 * If multiple PDFs: download as ZIP
 */
export async function downloadAllPDFs(pdfs: GeneratedPDF[], batchName?: string) {
    if (pdfs.length === 0) return

    if (pdfs.length === 1) {
        // Single file — prefer the PDF's own batchName (set when generated) over
        // the function arg, so each PDF gets the exact "Nama Batch" the user
        // configured for its day.
        const pdf = pdfs[0]
        const effectiveBatch = pdf.batchName ?? batchName
        const safe = effectiveBatch ? sanitizeFilename(effectiveBatch) : null
        const filename = safe
            ? `${safe}-${pdf.supplier}-${pdf.invoiceNumber}.pdf`
            : `Invoice-${pdf.supplier}-${pdf.invoiceNumber}.pdf`
        downloadPDF(pdf.blob, filename)
    } else {
        // ZIP filename uses the passed batchName (which represents the *download
        // session* — single-date or multi-date range — not per-PDF). Inner
        // file/folder structure inside the ZIP uses each PDF's own batchName.
        const safeBatchName = batchName ? sanitizeFilename(batchName) : null
        const zipFilename = safeBatchName
            ? `${safeBatchName}.zip`
            : `Invoices-${format(new Date(), 'yyyy-MM-dd')}.zip`
        await downloadAsZip(pdfs, zipFilename)
    }
}
