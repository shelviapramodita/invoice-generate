import { pdf } from '@react-pdf/renderer'
import JSZip from 'jszip'
import { format } from 'date-fns'
import { ParsedExcelData, InvoiceItemForm, InvoiceSummary } from '@/types'
import { getNextInvoiceNumber } from './utils'
import { JayamenTemplate } from './templates/jayamen-template'
import { UndiYuwonoTemplate } from './templates/undi-yuwono-template'
import { SekarWijayakusumaTemplate } from './templates/sekar-wijayakusuma-template'

export interface PDFGenerationOptions {
    invoiceDate: Date
    batchName?: string
    customerName?: string
    invoiceNumbers?: Record<string, string>
}

export interface GeneratedPDF {
    supplier: string
    blob: Blob
    invoiceNumber: string
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
    const { invoiceDate, customerName } = options

    let template

    // Select appropriate template based on supplier
    if (supplier.includes('JAYAMEN')) {
        template = JayamenTemplate({
            invoiceNumber,
            invoiceDate,
            items,
            customerName,
        })
    } else if (supplier.includes('UNDI') || supplier.includes('YUWONO')) {
        template = UndiYuwonoTemplate({
            invoiceNumber,
            invoiceDate,
            items,
            customerName,
        })
    } else if (supplier.includes('SEKAR') || supplier.includes('WIJAYAKUSUMA')) {
        template = SekarWijayakusumaTemplate({
            invoiceNumber,
            invoiceDate,
            items,
            customerName,
        })
    } else {
        // Default to Jayamen template if supplier not recognized
        template = JayamenTemplate({
            invoiceNumber,
            invoiceDate,
            items,
            customerName,
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
 */
export function downloadPDF(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
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
    const mergedBlob = new Blob([mergedPdfBytes], { type: 'application/pdf' })
    
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

        // Add each PDF to the zip
        pdfs.forEach((pdf) => {
            const pdfName = `Invoice-${pdf.supplier}-${pdf.invoiceNumber}.pdf`
            console.log('Adding to ZIP:', pdfName)
            zip.file(pdfName, pdf.blob)
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
        // Download single file
        const pdf = pdfs[0]
        const filename = batchName
            ? `${batchName}-${pdf.supplier}-${pdf.invoiceNumber}.pdf`
            : `Invoice-${pdf.supplier}-${pdf.invoiceNumber}.pdf`
        downloadPDF(pdfs[0].blob, filename)
    } else {
        // Download as ZIP
        const zipFilename = batchName
            ? `Invoices-${batchName}.zip`
            : `Invoices-${format(new Date(), 'yyyy-MM-dd')}.zip`

        await downloadAsZip(pdfs, zipFilename)
    }
}
