import React from 'react'
import { Text, View, StyleSheet } from '@react-pdf/renderer'
import { formatDate } from '../utils'

/**
 * Blok nomor + tanggal di kanan atas header, dipakai semua template supaya
 * tampilannya seragam. Warna mengikuti tema masing-masing CV.
 */
interface InvoiceMetaProps {
    numberLabel: string
    invoiceNumber: string
    invoiceDate: Date
    accentColor: string
    tintColor: string
}

const styles = StyleSheet.create({
    box: {
        width: 170,
        borderWidth: 1,
        borderRadius: 4,
        overflow: 'hidden',
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 5,
        paddingHorizontal: 8,
    },
    label: {
        fontSize: 8,
        color: '#555',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    value: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#111',
    },
})

export function InvoiceMeta({ numberLabel, invoiceNumber, invoiceDate, accentColor, tintColor }: InvoiceMetaProps) {
    return (
        <View style={[styles.box, { borderColor: accentColor }]}>
            <View style={[styles.row, { backgroundColor: tintColor, borderBottomWidth: 1, borderBottomColor: accentColor }]}>
                <Text style={styles.label}>{numberLabel}</Text>
                <Text style={styles.value}>{invoiceNumber}</Text>
            </View>
            <View style={styles.row}>
                <Text style={styles.label}>Tanggal</Text>
                <Text style={styles.value}>{formatDate(invoiceDate)}</Text>
            </View>
        </View>
    )
}
