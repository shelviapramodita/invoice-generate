'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
    User,
    LogOut,
    Shield,
    LayoutDashboard,
    CreditCard,
    Users,
    Settings,
    ChevronDown,
    Clock,
    CheckCircle,
    Monitor,
    History,
} from 'lucide-react'

interface UserProfile {
    name: string | null
    email: string
    role: string
    subscription_status?: string
    expires_at?: string | null
    last_login_at?: string | null
    last_login_device?: string | null
}

export function UserMenu() {
    const router = useRouter()
    const [profile, setProfile] = useState<UserProfile | null>(null)
    const [loading, setLoading] = useState(true)
    const [open, setOpen] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        fetchProfile()
    }, [])

    // Close menu on outside click
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const fetchProfile = async () => {
        try {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data: prof } = await supabase
                .from('profiles')
                .select('name, email, role, last_login_at, last_login_device')
                .eq('id', user.id)
                .single()

            if (!prof) return

            // Get subscription status
            const { data: sub } = await supabase
                .from('subscriptions')
                .select('status, expires_at')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single()

            setProfile({
                ...prof,
                subscription_status: sub?.status,
                expires_at: sub?.expires_at,
                last_login_at: prof.last_login_at,
                last_login_device: prof.last_login_device,
            })
        } catch (error) {
            console.error('Error fetching profile:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleLogout = async () => {
        localStorage.removeItem('invoice_session_id')
        const supabase = createClient()
        await supabase.auth.signOut()
        router.push('/login')
        router.refresh()
    }

    if (loading || !profile) {
        return (
            <div className="h-9 w-9 rounded-full bg-muted animate-pulse" />
        )
    }

    const isAdmin = profile.role === 'admin'
    const initials = (profile.name || profile.email)
        .split(' ')
        .map(w => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()

    const subActive = profile.subscription_status === 'active' && profile.expires_at && new Date(profile.expires_at) > new Date()
    const subPending = profile.subscription_status === 'pending'

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setOpen(!open)}
                className="flex items-center gap-2 rounded-full border bg-white hover:bg-muted/50 transition-colors pl-1 pr-3 py-1 shadow-sm"
            >
                <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                    {initials}
                </div>
                <span className="text-sm font-medium max-w-[120px] truncate hidden sm:block">
                    {profile.name || profile.email.split('@')[0]}
                </span>
                <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <div className="absolute right-0 top-full mt-2 w-72 rounded-xl border bg-white shadow-lg z-50 overflow-hidden animate-in fade-in-50 slide-in-from-top-2 duration-200">
                    {/* Profile Header */}
                    <div className="p-4 border-b bg-muted/30">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                                {initials}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm truncate">
                                    {profile.name || 'User'}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                    {profile.email}
                                </p>
                            </div>
                            {isAdmin && (
                                <span className="text-xs font-medium bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                                    Admin
                                </span>
                            )}
                        </div>

                        {/* Subscription Status */}
                        {!isAdmin && (
                            <div className="mt-3">
                                {subActive ? (
                                    <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 rounded-lg px-3 py-1.5">
                                        <CheckCircle className="h-3.5 w-3.5" />
                                        <span>Langganan aktif sampai {new Date(profile.expires_at!).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                    </div>
                                ) : subPending ? (
                                    <div className="flex items-center gap-2 text-xs text-yellow-700 bg-yellow-50 rounded-lg px-3 py-1.5">
                                        <Clock className="h-3.5 w-3.5" />
                                        <span>Menunggu approval admin</span>
                                    </div>
                                ) : (
                                    <Link href="/subscribe" onClick={() => setOpen(false)}>
                                        <div className="flex items-center gap-2 text-xs text-orange-700 bg-orange-50 rounded-lg px-3 py-1.5 hover:bg-orange-100 transition-colors cursor-pointer">
                                            <CreditCard className="h-3.5 w-3.5" />
                                            <span>Belum berlangganan</span>
                                        </div>
                                    </Link>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Last Login Info */}
                    {profile.last_login_at && (
                        <div className="px-4 py-2.5 border-b">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Monitor className="h-3.5 w-3.5 shrink-0" />
                                <div>
                                    <p>Login terakhir: {new Date(profile.last_login_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                                    {profile.last_login_device && (
                                        <p className="text-muted-foreground/70">{profile.last_login_device}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Menu Items */}
                    <div className="p-1.5">
                        {isAdmin && (
                            <>
                                <Link
                                    href="/admin"
                                    onClick={() => setOpen(false)}
                                    className="flex items-center gap-3 px-3 py-2 text-sm rounded-lg hover:bg-muted/50 transition-colors"
                                >
                                    <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
                                    Dashboard Admin
                                </Link>
                                <Link
                                    href="/admin/subscriptions"
                                    onClick={() => setOpen(false)}
                                    className="flex items-center gap-3 px-3 py-2 text-sm rounded-lg hover:bg-muted/50 transition-colors"
                                >
                                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                                    Subscriptions
                                </Link>
                                <Link
                                    href="/admin/users"
                                    onClick={() => setOpen(false)}
                                    className="flex items-center gap-3 px-3 py-2 text-sm rounded-lg hover:bg-muted/50 transition-colors"
                                >
                                    <Users className="h-4 w-4 text-muted-foreground" />
                                    Manage Users
                                </Link>
                                <Link
                                    href="/admin/login-history"
                                    onClick={() => setOpen(false)}
                                    className="flex items-center gap-3 px-3 py-2 text-sm rounded-lg hover:bg-muted/50 transition-colors"
                                >
                                    <History className="h-4 w-4 text-muted-foreground" />
                                    Login History
                                </Link>
                                <Link
                                    href="/admin/settings"
                                    onClick={() => setOpen(false)}
                                    className="flex items-center gap-3 px-3 py-2 text-sm rounded-lg hover:bg-muted/50 transition-colors"
                                >
                                    <Settings className="h-4 w-4 text-muted-foreground" />
                                    Settings
                                </Link>
                                <div className="border-t my-1.5" />
                            </>
                        )}
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-3 px-3 py-2 text-sm rounded-lg hover:bg-red-50 text-red-600 w-full transition-colors"
                        >
                            <LogOut className="h-4 w-4" />
                            Logout
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
