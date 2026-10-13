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
import {
    formatDate, formatNumber, getAssetPath,
    getInvoiceTitle, getInvoiceNumberLabel, shouldHideSignature, shouldShowStamp, getCustomerLabelPrefix,
    resolveDocType, InvoiceDocType,
} from '../utils'
import { InvoiceMeta } from './invoice-meta'

interface UdHidayatTemplateProps {
    invoiceNumber: string
    invoiceDate: Date
    items: InvoiceItemForm[]
    customerName?: string
    // Varian dokumen TAGIHAN/KWITANSI — undefined = TAGIHAN. Diabaikan untuk
    // invoice lama customer biasa (FAKTUR, lihat resolveDocType di ../doc-variant).
    documentType?: InvoiceDocType
}

// Styles for UD HIDAYAT template (Sky Blue theme)
const styles = StyleSheet.create({
    page: {
        padding: 30,
        fontSize: 10,
        fontFamily: 'Helvetica',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 15,
        paddingBottom: 10,
        borderBottomWidth: 3,
        borderBottomColor: '#0284C7',
        alignItems: 'flex-start',
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
        color: '#0369A1',
        marginBottom: 2,
    },
    companyAddress: {
        fontSize: 7.5,
        color: '#555',
        lineHeight: 1.3,
    },
    invoiceInfo: {
        alignItems: 'flex-end',
    },
    invoiceTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 4,
        color: '#0369A1', // Dark Sky Blue
    },
    customerSection: {
        marginBottom: 15,
        backgroundColor: '#F0F9FF', // Light sky blue background
        padding: 8,
        borderRadius: 4,
        borderLeftWidth: 3,
        borderLeftColor: '#0284C7',
    },
    customerLabel: {
        fontSize: 10,
        fontWeight: 'bold',
        marginBottom: 2,
        color: '#0369A1',
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
        backgroundColor: '#0284C7', // Sky Blue
        color: '#fff',
        padding: 6,
        fontWeight: 'bold',
        fontSize: 9,
    },
    tableRow: {
        flexDirection: 'row',
        padding: 6,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        fontSize: 9,
        alignItems: 'center',
        backgroundColor: '#F0F9FF',
    },
    tableRowAlt: {
        flexDirection: 'row',
        padding: 6,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        fontSize: 9,
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
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
        borderTopColor: '#0284C7',
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
        color: '#0C4A6E',
    },
    footer: {
        marginTop: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        paddingTop: 10,
    },
    paymentInfo: {
        fontSize: 10,
        width: '45%',
    },
    paymentLabel: {
        fontWeight: 'bold',
        marginBottom: 4,
        color: '#0284C7',
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
        minHeight: 50,
    },
    // FAKTUR lama: ttd + cap LUNAS rata kanan (tanpa cap, ttd di tengah garis)
    signatureRowWithStamp: {
        justifyContent: 'flex-end',
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
        marginTop: 8,
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

export function UdHidayatTemplate({
    invoiceNumber,
    invoiceDate,
    items,
    customerName = 'SPPG Pandansari',
    documentType,
}: UdHidayatTemplateProps) {
    const subtotal = items.reduce((sum, item) => sum + item.total, 0)
    const docType = resolveDocType(customerName, invoiceDate, documentType)
    const hideSignature = shouldHideSignature(docType)
    const showStamp = shouldShowStamp(docType)

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.companyBlock}>
                        <Image
                            src={getAssetPath('/assets/ud-hidayat/logo.png')}
                            style={styles.logo}
                        />
                        <View style={styles.companyText}>
                            <Text style={styles.companyName}>UD HIDAYAT</Text>
                            <Text style={styles.companyAddress}>
                                RT 03/RW 06, Desa Karang Lewas Kidul, Desa/Kelurahan Karanglewas Kidul, Kec. Karanglewas, Kab. Banyumas, Jawa Tengah. Kode Pos : 53161
                            </Text>
                        </View>
                    </View>
                    <View style={styles.invoiceInfo}>
                        <Text style={styles.invoiceTitle}>{getInvoiceTitle(docType)}</Text>
                        <InvoiceMeta
                            numberLabel={getInvoiceNumberLabel(docType)}
                            invoiceNumber={invoiceNumber}
                            invoiceDate={invoiceDate}
                            accentColor="#0284C7"
                            tintColor="#F0F9FF"
                        />
                    </View>
                </View>

                {/* Customer */}
                <View style={styles.customerSection}>
                    <Text style={styles.customerLabel}>{getCustomerLabelPrefix(docType)} {customerName}</Text>
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
                        <Text>BNI - 6419855552</Text>
                    </View>

                    <View style={styles.signatureSection}>
                        <View style={showStamp ? [styles.signatureRow, styles.signatureRowWithStamp] : styles.signatureRow}>
                            {!hideSignature && (
                                <Image
                                    src={getAssetPath('/assets/ud-hidayat/signature.png')}
                                    style={styles.signature}
                                />
                            )}
                            {!hideSignature && showStamp && (
                                <Image
                                    src={getAssetPath('/assets/common/stamp-lunas.png')}
                                    style={styles.stamp}
                                />
                            )}
                        </View>
                        {!hideSignature && <View style={styles.signatureLine} />}
                        {!hideSignature && (
                            <>
                                <Text style={styles.signatureName}>UD HIDAYAT</Text>
                                <Text style={styles.signatureDate}>{formatDate(invoiceDate)}</Text>
                            </>
                        )}
                    </View>
                </View>
            </Page>
        </Document>
    )
}
