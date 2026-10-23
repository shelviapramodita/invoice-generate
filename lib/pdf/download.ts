import { format } from 'date-fns'
import type { GeneratedPDF } from '@/types'

// Helper download di browser. Sengaja dipisah dari pdf-generator.ts supaya
// klik download tidak ikut memuat @react-pdf/renderer dan semua template.

// Helper to sanitize filename (remove/replace invalid characters)
function sanitizeFilename(name: string): string {
    return name
        .replace(/[\/\\:*?"<>|]/g, '-')  // Replace invalid chars with dash
        .replace(/\s+/g, ' ')             // Normalize spaces
        .trim()
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
 * Download multiple PDFs as a single ZIP file
 */
export async function downloadAsZip(pdfs: GeneratedPDF[], filename: string) {
    try {
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

        const zipBlob = await zip.generateAsync({ type: 'blob' })
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
