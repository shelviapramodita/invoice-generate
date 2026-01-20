import React from 'react'
import {
    Document,
    Page,
    Text,
    View,
    StyleSheet,
    Image,
    Font,
} from '@react-pdf/renderer'
import { InvoiceItemForm } from '@/types'
import { formatCurrency, formatDate, formatNumber, getAssetPath } from '../utils'

// Register fonts (optional - using default for now)
// Font.register({
//   family: 'Roboto',
//   src: 'https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Me5WZLCzYlKw.ttf',
// })

interface JayamenTemplateProps {
    invoiceNumber: string
    invoiceDate: Date
    items: InvoiceItemForm[]
    customerName?: string
}

// Styles for JAYAMEN template (Green theme)
const styles = StyleSheet.create({
    page: {
        padding: 30, // Reduced from 40 to fit more
        fontSize: 10,
        fontFamily: 'Helvetica',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 15,
        borderBottomWidth: 2,
        borderBottomColor: '#84CC16',
        paddingBottom: 8,
        alignItems: 'flex-end',
    },
    logo: {
        width: 90,
        height: 65,
        objectFit: 'contain',
    },
    invoiceInfo: {
        textAlign: 'right',
    },
    invoiceTitle: {
        fontSize: 28, // Increased for emphasis
        fontWeight: 'bold',
        marginBottom: 4,
        color: '#3F6212', // Darker green for title
    },
    invoiceNumber: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#000',
    },
    invoiceDate: {
        fontSize: 10,
        color: '#444',
    },
    customerSection: {
        marginBottom: 15,
        backgroundColor: '#F0FDF4', // Light green background matching Jayamen theme
        padding: 10,
        borderRadius: 4,
        borderLeftWidth: 3,
        borderLeftColor: '#84CC16', // Green accent
    },
    customerLabel: {
        fontSize: 10,
        fontWeight: 'bold',
        marginBottom: 2,
    },
    customerName: {
        fontSize: 12, // Increased for readability
    },
    table: {
        marginTop: 5,
        marginBottom: 10,
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#84CC16', // Lime green
        color: '#fff',
        padding: 6, // Reduced padding
        fontWeight: 'bold',
        fontSize: 9,
        alignItems: 'center',
    },
    tableRow: {
        flexDirection: 'row',
        backgroundColor: '#F0FDF4', // Very light green
        padding: 5, // Reduced padding for compactness
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        fontSize: 9,
        alignItems: 'center',
    },
    tableRowAlt: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        padding: 5, // Reduced padding for compactness
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        fontSize: 9,
        alignItems: 'center',
    },
    colNo: { width: '5%', textAlign: 'center' },
    colItem: { width: '35%' },
    colQty: { width: '15%', textAlign: 'right' }, // Increased width
    colUnit: { width: '10%', textAlign: 'center' },
    colPrice: { width: '17%', textAlign: 'right' },
    colTotal: { width: '18%', textAlign: 'right' },
    summary: {
        marginTop: 5,
        alignItems: 'flex-end',
    },
    summaryRow: {
        flexDirection: 'row',
        marginBottom: 2,
        width: 250, // Increased width
    },
    summaryLabel: {
        width: '50%',
        fontSize: 10,
    },
    summaryValue: {
        width: '50%',
        textAlign: 'right',
        fontSize: 10,
    },
    totalRow: {
        flexDirection: 'row',
        marginTop: 5,
        paddingTop: 5,
        borderTopWidth: 2,
        borderTopColor: '#4D7C0F', // Darker green
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
        fontSize: 14, // Larger total
        fontWeight: 'bold',
        color: '#1A2E05',
    },
    footer: {
        marginTop: 20, // Reduced from 40
        flexDirection: 'row',
        justifyContent: 'space-between',
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        paddingTop: 10,
    },
    paymentInfo: {
        fontSize: 10,
        width: '50%',
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

export function JayamenTemplate({
    invoiceNumber,
    invoiceDate,
    items,
    customerName = 'SPPG Pandansari',
}: JayamenTemplateProps) {
    const subtotal = items.reduce((sum, item) => sum + item.total, 0)

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                        <Image
                            src={getAssetPath('/assets/jayamen/logo.png')}
                            style={styles.logo}
                        />
                        <Text style={{
                            fontSize: 8,
                            fontWeight: 'bold',
                            letterSpacing: 0.5,
                            color: '#1A2E05',
                            marginLeft: -8,
                            marginBottom: 6,
                        }}>AJIBARANG</Text>
                    </View>
                    <View style={styles.invoiceInfo}>
                        <Text style={styles.invoiceTitle}>FAKTUR</Text>
                        <Text style={styles.invoiceNumber}>{invoiceNumber}</Text>
                        <Text style={styles.invoiceDate}>
                            TANGGAL: {formatDate(invoiceDate)}
                        </Text>
                    </View>
                </View>

                {/* Customer */}
                <View style={styles.customerSection}>
                    <Text style={styles.customerLabel}>Tagihan Kepada: {customerName}</Text>
                </View>

                {/* Table */}
                <View style={styles.table}>
                    {/* Table Header */}
                    <View style={styles.tableHeader}>
                        <Text style={styles.colNo}>No</Text>
                        <Text style={styles.colItem}>Item</Text>
                        <Text style={styles.colQty}>Kuantitas</Text>
                        <Text style={styles.colUnit}>Unit</Text>
                        <Text style={styles.colPrice}>Harga</Text>
                        <Text style={styles.colTotal}>Total</Text>
                    </View>

                    {/* Table Rows */}
                    {items.map((item, index) => (
                        <View
                            key={index}
                            style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlt}
                        >
                            <Text style={styles.colNo}>{index + 1}</Text>
                            <Text style={styles.colItem}>{item.item_name}</Text>
                            <Text style={styles.colQty}>{formatNumber(item.quantity)}</Text>
                            <Text style={styles.colUnit}>{item.unit}</Text>
                            <Text style={styles.colPrice}>{formatNumber(item.price)}</Text>
                            <Text style={styles.colTotal}>{formatNumber(item.total)}</Text>
                        </View>
                    ))}
                </View>

                {/* Summary */}
                <View style={styles.summary}>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Subtotal:</Text>
                        <Text style={styles.summaryValue}>{formatNumber(subtotal)}</Text>
                    </View>
                    <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Total:</Text>
                        <Text style={styles.totalValue}>Rp. {formatNumber(subtotal)}</Text>
                    </View>
                </View>

                {/* Footer */}
                <View style={styles.footer}>
                    <View style={styles.paymentInfo}>
                        <Text style={styles.paymentLabel}>INFO PEMBAYARAN</Text>
                        <Text>BNI - 0951810094</Text>
                    </View>

                    <View style={styles.signatureSection}>
                        <View style={styles.signatureRow}>
                            <Image
                                src={getAssetPath('/assets/jayamen/signature.png')}
                                style={styles.signature}
                            />
                            <Image
                                src={getAssetPath('/assets/common/stamp-lunas.png')}
                                style={styles.stamp}
                            />
                        </View>
                        <View style={styles.signatureLine} />
                        <Text style={styles.signatureName}>CV JAYAMEN</Text>
                        <Text style={styles.signatureDate}>{formatDate(invoiceDate)}</Text>
                    </View>
                </View>
            </Page>
        </Document>
    )
}
