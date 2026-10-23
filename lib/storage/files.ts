import { createClient } from '@/lib/supabase/client'

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
