'use client'

import { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Clock } from 'lucide-react'

interface CustomerNameInputProps {
    supplier: string
    value: string
    onChange: (value: string) => void
}

const STORAGE_KEY = 'recent-customer-names'
const MAX_RECENT = 5

export function CustomerNameInput({ supplier, value, onChange }: CustomerNameInputProps) {
    const [recentNames, setRecentNames] = useState<string[]>([])
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([])
    const inputRef = useRef<HTMLInputElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    // Load recent names from localStorage on mount
    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
            try {
                const parsed = JSON.parse(stored)
                setRecentNames(Array.isArray(parsed) ? parsed : [])
            } catch (e) {
                console.error('Failed to parse recent customer names:', e)
            }
        }
    }, [])

    // Save customer name to recent history
    const saveToRecent = (name: string) => {
        if (!name || name.trim().length < 2) return

        const trimmedName = name.trim()
        const updated = [trimmedName, ...recentNames.filter(n => n !== trimmedName)].slice(0, MAX_RECENT)
        
        setRecentNames(updated)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    }

    // Handle input change
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value
        onChange(newValue)

        // Filter suggestions based on input
        if (newValue.trim().length > 0) {
            const filtered = recentNames.filter(name =>
                name.toLowerCase().includes(newValue.toLowerCase())
            )
            setFilteredSuggestions(filtered)
            setShowSuggestions(filtered.length > 0)
        } else {
            setFilteredSuggestions(recentNames)
            setShowSuggestions(recentNames.length > 0)
        }
    }

    // Handle suggestion click
    const handleSuggestionClick = (name: string) => {
        onChange(name)
        setShowSuggestions(false)
    }

    // Handle input focus
    const handleFocus = () => {
        if (recentNames.length > 0) {
            setFilteredSuggestions(recentNames)
            setShowSuggestions(true)
        }
    }

    // Handle input blur - save to recent
    const handleBlur = () => {
        // Delay to allow suggestion click to register
        setTimeout(() => {
            setShowSuggestions(false)
            if (value && value.trim().length >= 2) {
                saveToRecent(value)
            }
        }, 200)
    }

    // Close suggestions when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setShowSuggestions(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    return (
        <div ref={containerRef} className="flex items-center gap-3 relative">
            <Label className="w-48 text-sm truncate" title={supplier}>
                {supplier}
            </Label>
            <div className="flex-1 relative">
                <Input
                    ref={inputRef}
                    value={value}
                    onChange={handleInputChange}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    placeholder="Contoh: SPPG Pandansari"
                    className="w-full"
                />
                
                {/* Suggestions Dropdown */}
                {showSuggestions && filteredSuggestions.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-md shadow-lg max-h-48 overflow-auto">
                        <div className="p-2">
                            <div className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                <span>Recently used</span>
                            </div>
                            {filteredSuggestions.map((name, index) => (
                                <button
                                    key={index}
                                    type="button"
                                    onClick={() => handleSuggestionClick(name)}
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-sm transition-colors"
                                >
                                    {name}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
