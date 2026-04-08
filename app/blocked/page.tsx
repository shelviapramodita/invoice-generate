'use client'

import { useState, useEffect } from 'react'
import AccountBlocked from '@/components/auth/account-blocked'

export default function BlockedPage() {
    const [profile, setProfile] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchProfile() {
            try {
                const res = await fetch('/api/account-status')
                const result = await res.json()
                if (result.success) {
                    setProfile(result.data)
                }
            } catch (error) {
                console.error('Error:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchProfile()
    }, [])

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-50 to-neutral-100">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
        )
    }

    if (!profile) return null

    return <AccountBlocked profile={profile} />
}
