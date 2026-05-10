'use client'

import { useMemo, useState } from 'react'
import { SheetEntry } from '@/types'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Calendar, AlertTriangle, CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react'

interface SheetPickerProps {
    sheets: SheetEntry[]
    selectedSheetNames: string[]
    onChange: (sheetNames: string[]) => void
}

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(amount)
}

function groupKey(s: SheetEntry): string {
    const iso = s.detectedDate || s.dateRangeStart
    if (!iso) return 'Lainnya'
    const d = new Date(iso)
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
    return `${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

export function SheetPicker({ sheets, selectedSheetNames, onChange }: SheetPickerProps) {
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

    const groups = useMemo(() => {
        const map = new Map<string, SheetEntry[]>()
        sheets.forEach(s => {
            const key = groupKey(s)
            if (!map.has(key)) map.set(key, [])
            map.get(key)!.push(s)
        })
        // Sort sheets within each group by detected date ascending
        map.forEach(arr => arr.sort((a, b) => {
            const da = a.detectedDate || a.dateRangeStart || ''
            const db = b.detectedDate || b.dateRangeStart || ''
            return da.localeCompare(db)
        }))
        return Array.from(map.entries())
    }, [sheets])

    const allSelected = sheets.length > 0 && selectedSheetNames.length === sheets.length

    const toggleSheet = (sheetName: string) => {
        if (selectedSheetNames.includes(sheetName)) {
            onChange(selectedSheetNames.filter(n => n !== sheetName))
        } else {
            onChange([...selectedSheetNames, sheetName])
        }
    }

    const toggleAll = () => {
        if (allSelected) {
            onChange([])
        } else {
            onChange(sheets.map(s => s.sheetName))
        }
    }

    const toggleGroup = (groupName: string, sheetsInGroup: SheetEntry[]) => {
        const groupSheetNames = sheetsInGroup.map(s => s.sheetName)
        const allInGroupSelected = groupSheetNames.every(n => selectedSheetNames.includes(n))
        if (allInGroupSelected) {
            onChange(selectedSheetNames.filter(n => !groupSheetNames.includes(n)))
        } else {
            const newSelection = Array.from(new Set([...selectedSheetNames, ...groupSheetNames]))
            onChange(newSelection)
        }
    }

    const toggleCollapse = (groupName: string) => {
        setCollapsedGroups(prev => {
            const next = new Set(prev)
            if (next.has(groupName)) next.delete(groupName)
            else next.add(groupName)
            return next
        })
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium">
                        {sheets.length} hari terdeteksi · {selectedSheetNames.length} dipilih
                    </p>
                    <p className="text-xs text-muted-foreground">
                        Pilih hari yang ingin di-generate invoice-nya
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={toggleAll}>
                    {allSelected ? 'Unselect All' : 'Select All'}
                </Button>
            </div>

            <div className="border rounded-lg divide-y max-h-[500px] overflow-y-auto">
                {groups.map(([groupName, sheetsInGroup]) => {
                    const collapsed = collapsedGroups.has(groupName)
                    const groupSelectedCount = sheetsInGroup.filter(s => selectedSheetNames.includes(s.sheetName)).length
                    return (
                        <div key={groupName}>
                            {/* Group header — sticky, solid bg + border so list items
                                don't show through when scrolling. */}
                            <div className="flex items-center gap-2 px-3 py-2 bg-muted sticky top-0 z-10 border-b border-border">
                                <button
                                    type="button"
                                    onClick={() => toggleCollapse(groupName)}
                                    className="flex items-center gap-1 text-sm font-medium hover:text-primary"
                                >
                                    {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                    {groupName}
                                </button>
                                <span className="text-xs text-muted-foreground">
                                    ({groupSelectedCount}/{sheetsInGroup.length})
                                </span>
                                <button
                                    type="button"
                                    onClick={() => toggleGroup(groupName, sheetsInGroup)}
                                    className="ml-auto text-xs text-primary hover:underline"
                                >
                                    {groupSelectedCount === sheetsInGroup.length ? 'Unselect group' : 'Select group'}
                                </button>
                            </div>

                            {/* Sheets in this group */}
                            {!collapsed && sheetsInGroup.map(sheet => {
                                const isSelected = selectedSheetNames.includes(sheet.sheetName)
                                const isMultiDay = sheet.type === 'multi-day'
                                const categoryLabel =
                                    sheet.category === 'operasional' ? 'Operasional'
                                    : sheet.category === 'operasional-galon' ? 'Operasional Galon'
                                    : null
                                return (
                                    <label
                                        key={sheet.sheetName}
                                        className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/30 transition-colors ${
                                            isSelected ? 'bg-primary/5' : ''
                                        }`}
                                    >
                                        <Checkbox
                                            checked={isSelected}
                                            onCheckedChange={() => toggleSheet(sheet.sheetName)}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-medium text-sm">{sheet.label}</span>
                                                {isMultiDay ? (
                                                    <Badge variant="secondary" className="text-[10px] gap-1 bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
                                                        <AlertTriangle className="h-3 w-3" />
                                                        Range
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="secondary" className="text-[10px] gap-1 bg-green-100 text-green-800 hover:bg-green-100">
                                                        <CheckCircle2 className="h-3 w-3" />
                                                        1 hari
                                                    </Badge>
                                                )}
                                                {categoryLabel && (
                                                    <Badge variant="secondary" className="text-[10px] bg-blue-100 text-blue-800 hover:bg-blue-100">
                                                        {categoryLabel}
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-xs text-muted-foreground truncate" title={sheet.sheetName}>
                                                {sheet.sheetName} · {sheet.totalItems} item · {formatCurrency(sheet.grandTotal)}
                                            </p>
                                        </div>
                                        <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                    </label>
                                )
                            })}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
