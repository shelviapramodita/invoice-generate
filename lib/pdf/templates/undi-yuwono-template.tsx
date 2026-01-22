import React from 'react'
import {
    Document,
    Page,
    Text,
    View,
    StyleSheet,
    Image,
} from '@react-pdf/renderer'
import { InvoiceItemForm } from '@/types'
import { formatDate, formatNumber, getAssetPath } from '../utils'

interface UndiYuwonoTemplateProps {
    invoiceNumber: string
    invoiceDate: Date
    items: InvoiceItemForm[]
    customerName?: string
}

// Styles for UNDI YUWONO template (Gray/Neutral theme)
const styles = StyleSheet.create({
    page: {
        padding: 30, // Reduced padding
        fontSize: 10,
        fontFamily: 'Helvetica',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 15,
        paddingBottom: 8,
        borderBottomWidth: 2,
        borderBottomColor: '#4B5563',
        alignItems: 'flex-end',
    },
    logo: {
        width: 180,
        height: 50,
        objectFit: 'contain',
    },
    companyName: {
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 2,
        color: '#333',
    },
    // ...
    // Inside component

    companyAddress: {
        fontSize: 9,
        color: '#666',
    },
    invoiceInfo: {
        textAlign: 'right',
        justifyContent: 'center',
    },
    invoiceTitle: {
        fontSize: 26, // Larger title
        fontWeight: 'bold',
        marginBottom: 4,
        color: '#333',
    },
    invoiceNumber: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#555',
    },
    invoiceDate: {
        fontSize: 10,
        color: '#666',
    },
    customerSection: {
        marginBottom: 15,
        paddingTop: 5,
        paddingBottom: 10,
        backgroundColor: '#F9FAFB', // Very light gray background
        padding: 10,
        borderLeftWidth: 3,
        borderLeftColor: '#10B981', // Green accent
        flexDirection: 'row', // Horizontal layout for customer info
        alignItems: 'center',
    },
    customerLabel: {
        fontSize: 10,
        marginRight: 5, // Reduced from default gap to 1 space equivalent
        color: '#666',
    },
    customerName: {
        fontSize: 10,
        fontWeight: 'bold',
    },
    table: {
        marginTop: 10,
        marginBottom: 15,
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#F3F4F6', // Lighter header background
        color: '#111',
        padding: 6,
        fontWeight: 'bold',
        fontSize: 9,
        borderBottomWidth: 1,
        borderBottomColor: '#9CA3AF',
    },
    tableRow: {
        flexDirection: 'row',
        padding: 6, // Compact padding
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
        fontSize: 9,
        alignItems: 'center',
    },
    colNo: { width: '5%', textAlign: 'center' },
    colItem: { width: '35%' },
    colUnit: { width: '10%', textAlign: 'center' },
    colQty: { width: '15%', textAlign: 'right' },
    colPrice: { width: '17%', textAlign: 'right' },
    colTotal: { width: '18%', textAlign: 'right' },
    summary: {
        marginTop: 10,
        alignItems: 'flex-end',
    },
    summaryRow: {
        flexDirection: 'row',
        marginBottom: 4,
        width: 250,
    },
    summaryLabel: {
        width: '50%',
        fontSize: 10,
        color: '#444',
    },
    summaryValue: {
        width: '50%',
        textAlign: 'right',
        fontSize: 10,
        fontWeight: 'bold',
    },
    totalRow: {
        flexDirection: 'row',
        marginTop: 5,
        paddingTop: 5,
        borderTopWidth: 2,
        borderTopColor: '#333',
        width: 250,
    },
    totalLabel: {
        width: '40%',
        fontSize: 12,
        fontWeight: 'bold',
    },
    totalValue: {
        width: '60%',
        textAlign: 'right',
        fontSize: 14,
        fontWeight: 'bold',
    },
    footer: {
        marginTop: 30, // Reduced from 40
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    paymentInfo: {
        fontSize: 10,
        width: '40%',
    },
    paymentLabel: {
        fontWeight: 'bold',
        marginBottom: 4,
        textDecoration: 'underline',
    },
    signatureSection: {
        alignItems: 'center',
        width: 180,
    },
    signatureRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'flex-end',
        gap: 15,
        width: '100%',
        marginBottom: 2,
    },
    stamp: {
        width: 50,
        height: 50,
    },
    signature: {
        width: 90,
        height: 45,
    },
    signatureLine: {
        borderBottomWidth: 1,
        borderBottomColor: '#000',
        width: '100%',
        marginBottom: 2,
    },
    signatureName: {
        fontSize: 9,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    signatureDate: {
        fontSize: 8,
        color: '#666',
        marginTop: 1,
        textAlign: 'center',
    },
})

export function UndiYuwonoTemplate({
    invoiceNumber,
    invoiceDate,
    items,
    customerName = 'SPPG PANDANSARI',
}: UndiYuwonoTemplateProps) {
    const subtotal = items.reduce((sum, item) => sum + item.total, 0)

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {/* Header */}
                <View style={styles.header}>
                    <Image
                        src={getAssetPath('/assets/undi-yuwono/logo.png')}
                        style={styles.logo}
                    />
                    <View style={styles.invoiceInfo}>
                        <Text style={styles.invoiceTitle}>FAKTUR</Text>
                        <Text style={styles.invoiceNumber}>{invoiceNumber}</Text>
                        <Text style={styles.invoiceDate}>
                            Tanggal: {formatDate(invoiceDate)}
                        </Text>
                    </View>
                </View>

                {/* Customer */}
                <View style={styles.customerSection}>
                    <Text style={styles.customerLabel}>Tagihan Kepada:</Text>
                    <Text style={styles.customerName}>{customerName}</Text>
                </View>

                {/* Table */}
                <View style={styles.table}>
                    {/* Table Header */}
                    <View style={styles.tableHeader}>
                        <Text style={styles.colNo}>#</Text>
                        <Text style={styles.colItem}>Item</Text>
                        <Text style={styles.colUnit}>Unit</Text>
                        <Text style={styles.colQty}>Kuantitas</Text>
                        <Text style={styles.colPrice}>Biaya satuan</Text>
                        <Text style={styles.colTotal}>Total</Text>
                    </View>

                    {/* Table Rows */}
                    {items.map((item, index) => (
                        <View key={index} style={styles.tableRow}>
                            <Text style={styles.colNo}>{index + 1}</Text>
                            <Text style={styles.colItem}>{item.item_name}</Text>
                            <Text style={styles.colUnit}>{item.unit}</Text>
                            <Text style={styles.colQty}>{formatNumber(item.quantity)}</Text>
                            <Text style={styles.colPrice}>{formatCurrency(item.price)}</Text>
                            <Text style={styles.colTotal}>{formatCurrency(item.total)}</Text>
                        </View>
                    ))}
                </View>

                {/* Summary */}
                <View style={styles.summary}>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Subtotal</Text>
                        <Text style={styles.summaryValue}>{formatCurrency(subtotal)}</Text>
                    </View>
                    <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Total</Text>
                        <Text style={styles.totalValue}>{formatCurrency(subtotal)}</Text>
                    </View>
                </View>

                {/* Footer */}
                <View style={styles.footer}>
                    <View style={styles.paymentInfo}>
                        <Text style={styles.paymentLabel}>Info Pembayaran</Text>
                        <Text>BNI 0330250705</Text>
                    </View>

                    <View style={styles.signatureSection}>
                        <View style={styles.signatureRow}>
                            <Image
                                src={getAssetPath('/assets/undi-yuwono/signature.png')}
                                style={styles.signature}
                            />
                            <Image
                                src={getAssetPath('/assets/common/stamp-lunas.png')}
                                style={styles.stamp}
                            />
                        </View>
                        <View style={styles.signatureLine} />
                        <Text style={styles.signatureName}>UMKM UNDI YUWONO</Text>
                        <Text style={styles.signatureDate}>{formatDate(invoiceDate)}</Text>
                    </View>
                </View>
            </Page>
        </Document>
    )
}

// Helper function formatCurrency (reused from utils)
function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })
        .format(amount)
        .replace('IDR', 'Rp')
        .trim()
}
