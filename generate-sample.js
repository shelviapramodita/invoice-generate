const fs = require('fs');
const XLSX = require('xlsx');

// Read CSV
const csvContent = fs.readFileSync('sample-data.csv', 'utf-8');

// Parse CSV
const wb = XLSX.utils.book_new();
const ws = XLSX.utils.json_to_sheet(
    csvContent.split('\n').slice(1).map(line => {
        const [No, SUPPLIER, ITEM, QTY, SATUAN, HARGA, TOTAL] = line.split(',');
        if (!SUPPLIER) return null;
        return {
            No, SUPPLIER, ITEM, QTY: parseFloat(QTY), SATUAN, HARGA: parseFloat(HARGA), TOTAL: parseFloat(TOTAL)
        };
    }).filter(Boolean)
);

XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
XLSX.writeFile(wb, 'sample-data.xlsx');
console.log('sample-data.xlsx created!');
