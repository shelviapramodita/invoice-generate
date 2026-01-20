'use client'

import { useState } from 'react'
import { Search, Calendar as CalendarIcon, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { cn } from '@/lib/utils'

export interface FilterState {
    search: string
    supplier: string
    status: string
    dateFrom: Date | null
    dateTo: Date | null
}

interface HistoryFiltersProps {
    filters: FilterState
    onFiltersChange: (filters: FilterState) => void
    suppliers: string[]
}

const STATUS_OPTIONS = [
    { value: 'all', label: 'Semua Status' },
    { value: 'generated', label: 'Generated' },
    { value: 'completed', label: 'Completed' },
]

export function HistoryFilters({ filters, onFiltersChange, suppliers }: HistoryFiltersProps) {
    const handleSearchChange = (value: string) => {
        onFiltersChange({ ...filters, search: value })
    }

    const handleSupplierChange = (value: string) => {
        onFiltersChange({ ...filters, supplier: value })
    }

    const handleStatusChange = (value: string) => {
        onFiltersChange({ ...filters, status: value })
    }

    const handleDateFromChange = (date: Date | undefined) => {
        onFiltersChange({ ...filters, dateFrom: date || null })
    }

    const handleDateToChange = (date: Date | undefined) => {
        onFiltersChange({ ...filters, dateTo: date || null })
    }

    const handleClearFilters = () => {
        onFiltersChange({
            search: '',
            supplier: 'all',
            status: 'all',
            dateFrom: null,
            dateTo: null,
        })
    }

    const activeFilterCount = [
        filters.search,
        filters.supplier !== 'all',
        filters.status !== 'all',
        filters.dateFrom,
        filters.dateTo,
    ].filter(Boolean).length

    return (
        <div className="space-y-4">
            {/* Search Bar */}
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Cari batch name atau invoice number..."
                        value={filters.search}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        className="pl-9"
                    />
                </div>
                {activeFilterCount > 0 && (
                    <Button variant="ghost" onClick={handleClearFilters}>
                        <X className="mr-2 h-4 w-4" />
                        Clear ({activeFilterCount})
                    </Button>
                )}
            </div>

            {/* Filters Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Date From */}
                <div className="space-y-2">
                    <Label htmlFor="dateFrom">Dari Tanggal</Label>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                className={cn(
                                    'w-full justify-start text-left font-normal',
                                    !filters.dateFrom && 'text-muted-foreground'
                                )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {filters.dateFrom ? format(filters.dateFrom, 'dd MMM yyyy', { locale: id }) : 'Pilih tanggal'}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                mode="single"
                                selected={filters.dateFrom || undefined}
                                onSelect={handleDateFromChange}
                                initialFocus
                            />
                        </PopoverContent>
                    </Popover>
                </div>

                {/* Date To */}
                <div className="space-y-2">
                    <Label htmlFor="dateTo">Sampai Tanggal</Label>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                className={cn(
                                    'w-full justify-start text-left font-normal',
                                    !filters.dateTo && 'text-muted-foreground'
                                )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {filters.dateTo ? format(filters.dateTo, 'dd MMM yyyy', { locale: id }) : 'Pilih tanggal'}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                mode="single"
                                selected={filters.dateTo || undefined}
                                onSelect={handleDateToChange}
                                initialFocus
                            />
                        </PopoverContent>
                    </Popover>
                </div>

                {/* Supplier Filter */}
                <div className="space-y-2">
                    <Label htmlFor="supplier">Supplier</Label>
                    <Select value={filters.supplier} onValueChange={handleSupplierChange}>
                        <SelectTrigger>
                            <SelectValue placeholder="Semua Supplier" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Semua Supplier</SelectItem>
                            {suppliers.map((supplier) => (
                                <SelectItem key={supplier} value={supplier}>
                                    {supplier}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Status Filter */}
                <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select value={filters.status} onValueChange={handleStatusChange}>
                        <SelectTrigger>
                            <SelectValue placeholder="Semua Status" />
                        </SelectTrigger>
                        <SelectContent>
                            {STATUS_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Active Filters */}
            {activeFilterCount > 0 && (
                <div className="flex flex-wrap gap-2">
                    {filters.search && (
                        <Badge variant="secondary">
                            Search: {filters.search}
                            <button
                                className="ml-2"
                                onClick={() => handleSearchChange('')}
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </Badge>
                    )}
                    {filters.supplier !== 'all' && (
                        <Badge variant="secondary">
                            Supplier: {filters.supplier}
                            <button
                                className="ml-2"
                                onClick={() => handleSupplierChange('all')}
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </Badge>
                    )}
                    {filters.status !== 'all' && (
                        <Badge variant="secondary">
                            Status: {filters.status}
                            <button
                                className="ml-2"
                                onClick={() => handleStatusChange('all')}
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </Badge>
                    )}
                    {filters.dateFrom && (
                        <Badge variant="secondary">
                            From: {format(filters.dateFrom, 'dd MMM yyyy', { locale: id })}
                            <button
                                className="ml-2"
                                onClick={() => handleDateFromChange(undefined)}
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </Badge>
                    )}
                    {filters.dateTo && (
                        <Badge variant="secondary">
                            To: {format(filters.dateTo, 'dd MMM yyyy', { locale: id })}
                            <button
                                className="ml-2"
                                onClick={() => handleDateToChange(undefined)}
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </Badge>
                    )}
                </div>
            )}
        </div>
    )
}
