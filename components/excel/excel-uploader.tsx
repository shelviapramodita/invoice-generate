'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, X } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { parseExcelFile } from '@/lib/excel-parser'
import { ParsedExcelData } from '@/types'

interface ExcelUploaderProps {
    onParsed: (data: ParsedExcelData, fileName: string) => void
}

export function ExcelUploader({ onParsed }: ExcelUploaderProps) {
    const [file, setFile] = useState<File | null>(null)
    const [parsing, setParsing] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        const selectedFile = acceptedFiles[0]
        if (!selectedFile) return

        setFile(selectedFile)
        setError(null)
        setParsing(true)

        try {
            const result = await parseExcelFile(selectedFile)

            if (!result.success) {
                setError(result.error || 'Gagal mem-parse file')
                setParsing(false)
                return
            }

            if (result.data) {
                onParsed(result.data, selectedFile.name)
            }
        } catch (err: any) {
            setError(err.message || 'Terjadi kesalahan')
        } finally {
            setParsing(false)
        }
    }, [onParsed])

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            'application/vnd.ms-excel': ['.xls'],
            'text/csv': ['.csv'],
        },
        maxFiles: 1,
        multiple: false,
    })

    const handleRemove = () => {
        setFile(null)
        setError(null)
    }

    return (
        <div className="space-y-4">
            {!file ? (
                <Card
                    {...getRootProps()}
                    className={`border-2 border-dashed cursor-pointer transition-colors ${isDragActive
                            ? 'border-primary bg-primary/5'
                            : 'border-muted-foreground/25 hover:border-primary/50'
                        }`}
                >
                    <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                        <input {...getInputProps()} />
                        <div className="mb-4 rounded-full bg-primary/10 p-4">
                            <Upload className="h-8 w-8 text-primary" />
                        </div>
                        {isDragActive ? (
                            <p className="text-lg font-medium">Drop file di sini...</p>
                        ) : (
                            <>
                                <p className="text-lg font-medium mb-2">
                                    Drag & drop file Excel atau klik untuk browse
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    Mendukung format .xlsx, .xls, .csv
                                </p>
                            </>
                        )}
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-start gap-4">
                            <div className="rounded-lg bg-primary/10 p-3">
                                <FileSpreadsheet className="h-6 w-6 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{file.name}</p>
                                <p className="text-sm text-muted-foreground">
                                    {(file.size / 1024).toFixed(2)} KB
                                </p>
                                {parsing && (
                                    <div className="mt-2 flex items-center gap-2 text-sm text-blue-600">
                                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                        Memproses file...
                                    </div>
                                )}
                                {error && (
                                    <div className="mt-2 flex items-start gap-2 text-sm text-destructive">
                                        <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                        <span>{error}</span>
                                    </div>
                                )}
                            </div>
                            {!parsing && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={handleRemove}
                                    className="flex-shrink-0"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
