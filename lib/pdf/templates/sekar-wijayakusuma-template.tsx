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

interface SekarWijayakusumaTemplateProps {
    invoiceNumber: string
    invoiceDate: Date
    items: InvoiceItemForm[]
    customerName?: string
    // Nama yang tercetak di bawah tanda tangan. Beberapa sheet Excel nulis
    // supplier ini atas nama pemilik rekening ("SUSILO WIDYONO") bukan nama
    // CV-nya, tapi logo/header/info pembayaran tetap sama persis.
    signatureName?: string
}

// Styles for NUSANTARA FOOD template (Purple theme)
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
        paddingBottom: 10,
        borderBottomWidth: 3,
        borderBottomColor: '#7C3F73',
        alignItems: 'flex-start', // Align to top
    },
    companyBlock: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    logo: {
        width: 55,
        height: 55,
        objectFit: 'contain',
        marginRight: 10,
    },
    companyText: {
        width: 200,
    },
    companyName: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#4A2545',
        marginBottom: 2,
    },
    companyAddress: {
        fontSize: 7.5,
        color: '#555',
        lineHeight: 1.3,
    },
    invoiceInfo: {
        textAlign: 'right',
    },
    invoiceTitle: {
        fontSize: 28, // Larger title
        fontWeight: 'bold',
        marginBottom: 4,
        color: '#4A2545', // Dark purple
    },
    invoiceNumber: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#000',
    },
    invoiceDate: {
        fontSize: 10,
        color: '#555',
    },
    customerSection: {
        marginBottom: 15,
        backgroundColor: '#F5EEF4', // Light purple background for customer info
        padding: 8,
        borderRadius: 4,
    },
    customerLabel: {
        fontSize: 10,
        fontWeight: 'bold',
        marginBottom: 2,
        color: '#4A2545',
    },
    customerName: {
        fontSize: 12,
        fontWeight: 'bold',
    },
    table: {
        marginTop: 10,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#7C3F73', // Purple
        color: '#fff',
        padding: 6, // Reduced padding
        fontWeight: 'bold',
        fontSize: 9,
    },
    tableRow: {
        flexDirection: 'row',
        padding: 6, // Compact padding
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        fontSize: 9,
        alignItems: 'center',
    },
    colNo: { width: '5%', textAlign: 'center' },
    colItem: { width: '35%' },
    colQty: { width: '12%', textAlign: 'right' },
    colUnit: { width: '10%', textAlign: 'center' },
    colPrice: { width: '18%', textAlign: 'right' },
    colTotal: { width: '20%', textAlign: 'right' },
    summary: {
        marginTop: 10,
        alignItems: 'flex-end',
    },
    summaryRow: {
        flexDirection: 'row',
        marginBottom: 2,
        width: 250,
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
        borderTopColor: '#7C3F73',
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
        color: '#4A2545',
    },
    footer: {
        marginTop: 20, // Reduced margin
        flexDirection: 'row',
        justifyContent: 'space-between',
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        paddingTop: 10,
    },
    paymentInfo: {
        fontSize: 10,
        width: '40%',
    },
    paymentLabel: {
        fontWeight: 'bold',
        marginBottom: 4,
        color: '#7C3F73',
    },
    signatureSection: {
        alignItems: 'center',
        width: 200,
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
        fontSize: 8,
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

export function SekarWijayakusumaTemplate({
    invoiceNumber,
    invoiceDate,
    items,
    customerName = 'SPPG Pandansari',
    signatureName = 'NUSANTARA FOOD',
}: SekarWijayakusumaTemplateProps) {
    const subtotal = items.reduce((sum, item) => sum + item.total, 0)

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.companyBlock}>
                        <Image
                            src={getAssetPath('/assets/sekar-wijayakusuma/logo.png')}
                            style={styles.logo}
                        />
                        <View style={styles.companyText}>
                            <Text style={styles.companyName}>NUSANTARA FOOD</Text>
                            <Text style={styles.companyAddress}>
                                {'Cihonje, RT 002/012 Desa/Kelurahan Cihonje,\nKec. Gumelar, Kab. Banyumas, Jawa Tengah 54165'}
                            </Text>
                        </View>
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
                        <View key={index} style={styles.tableRow}>
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
                        <Text>BNI - 2106821810</Text>
                    </View>

                    <View style={styles.signatureSection}>
                        <View style={styles.signatureRow}>
                            <Image
                                src={getAssetPath('/assets/sekar-wijayakusuma/signature.png')}
                                style={styles.signature}
                            />
                            <Image
                                src={getAssetPath('/assets/common/stamp-lunas.png')}
                                style={styles.stamp}
                            />
                        </View>
                        <View style={styles.signatureLine} />
                        <Text style={styles.signatureName}>{signatureName}</Text>
                        <Text style={styles.signatureDate}>{formatDate(invoiceDate)}</Text>
                    </View>
                </View>
            </Page>
        </Document>
    )
}
