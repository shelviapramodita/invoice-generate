import { createClient } from '@/lib/supabase/client'

/**
 * Upload Excel file to Supabase Storage
 * @param file - Excel file blob or File object
 * @param filename - Filename to save as
 * @returns File path in storage
 */
export async function uploadExcelFile(
    file: Blob | File,
    filename: string
): Promise<string> {
    const supabase = createClient()

    // Generate unique filename with timestamp
    const timestamp = Date.now()
    const uniqueFilename = `${timestamp}-${filename}`

    const { data, error } = await supabase.storage
        .from('excel-files')
        .upload(uniqueFilename, file, {
            cacheControl: '3600',
            upsert: false,
        })

    if (error) {
        console.error('Error uploading Excel file:', error)
        throw new Error(`Failed to upload Excel file: ${error.message}`)
    }

    return data.path
}

/**
 * Upload PDF file to Supabase Storage
 * @param file - PDF blob
 * @param filename - Filename to save as
 * @returns File path in storage
 */
export async function uploadPDFFile(
    file: Blob,
    filename: string
): Promise<string> {
    const supabase = createClient()

    // Generate unique filename with timestamp
    const timestamp = Date.now()
    const uniqueFilename = `${timestamp}-${filename}`

    const { data, error } = await supabase.storage
        .from('generated-pdfs')
        .upload(uniqueFilename, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: 'application/pdf',
        })

    if (error) {
        console.error('Error uploading PDF file:', error)
        throw new Error(`Failed to upload PDF file: ${error.message}`)
    }

    return data.path
}

/**
 * Get public URL for a file in storage
 * @param bucket - Bucket name ('excel-files' or 'generated-pdfs')
 * @param path - File path in storage
 * @returns Public URL
 */
export function getFileUrl(
    bucket: 'excel-files' | 'generated-pdfs',
    path: string
): string {
    const supabase = createClient()

    const { data } = supabase.storage.from(bucket).getPublicUrl(path)

    return data.publicUrl
}

/**
 * Download file from storage
 * @param bucket - Bucket name
 * @param path - File path in storage
 * @returns File blob
 */
export async function downloadFile(
    bucket: 'excel-files' | 'generated-pdfs',
    path: string
): Promise<Blob> {
    const supabase = createClient()

    const { data, error } = await supabase.storage.from(bucket).download(path)

    if (error) {
        console.error('Error downloading file:', error)
        throw new Error(`Failed to download file: ${error.message}`)
    }

    return data
}

/**
 * Delete file from storage
 * @param bucket - Bucket name
 * @param path - File path in storage
 */
export async function deleteFile(
    bucket: 'excel-files' | 'generated-pdfs',
    path: string
): Promise<void> {
    const supabase = createClient()

    const { error } = await supabase.storage.from(bucket).remove([path])

    if (error) {
        console.error('Error deleting file:', error)
        throw new Error(`Failed to delete file: ${error.message}`)
    }
}

/**
 * Delete multiple files from storage
 * @param bucket - Bucket name
 * @param paths - Array of file paths
 */
export async function deleteFiles(
    bucket: 'excel-files' | 'generated-pdfs',
    paths: string[]
): Promise<void> {
    const supabase = createClient()

    const { error } = await supabase.storage.from(bucket).remove(paths)

    if (error) {
        console.error('Error deleting files:', error)
        throw new Error(`Failed to delete files: ${error.message}`)
    }
}
