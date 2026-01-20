import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText, Upload, History, FileSpreadsheet } from 'lucide-react'

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-950 dark:to-neutral-900">
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight mb-4">
            Invoice Generator
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Generate invoice otomatis dari data Excel dengan deteksi CV dan export ke PDF
          </p>
        </div>

        {/* Main Actions */}
        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-12">
          {/* Upload Card */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Upload className="w-6 h-6 text-primary" />
              </div>
              <CardTitle>Upload Excel Baru</CardTitle>
              <CardDescription>
                Upload file Excel, sistem akan otomatis detect dan pisahkan bahan per CV
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/upload">
                <Button className="w-full" size="lg">
                  Mulai Upload
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* History Card */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <History className="w-6 h-6 text-primary" />
              </div>
              <CardTitle>History Invoice</CardTitle>
              <CardDescription>
                Lihat, edit, dan regenerate invoice yang pernah dibuat
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/history">
                <Button variant="outline" className="w-full" size="lg">
                  Lihat History
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Features */}
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-semibold text-center mb-8">Fitur Utama</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <FileSpreadsheet className="w-8 h-8 mb-2 text-primary" />
                <CardTitle className="text-lg">Auto Detect CV</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Sistem otomatis memisahkan bahan sesuai dengan 3 CV berdasarkan acuan
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <FileText className="w-8 h-8 mb-2 text-primary" />
                <CardTitle className="text-lg">Generate PDF</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Generate invoice dalam format PDF sesuai design, bisa individual atau merged
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <History className="w-8 h-8 mb-2 text-primary" />
                <CardTitle className="text-lg">Edit & Regenerate</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Edit data dari history kapan saja dan regenerate PDF dengan mudah
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
