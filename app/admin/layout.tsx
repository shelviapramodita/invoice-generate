'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { LayoutDashboard, Users, CreditCard, Settings, ArrowLeft, LogOut, History } from 'lucide-react'

const navItems = [
    { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/subscriptions', label: 'Subscriptions', icon: CreditCard },
    { href: '/admin/users', label: 'Users', icon: Users },
    { href: '/admin/login-history', label: 'Login History', icon: History },
    { href: '/admin/settings', label: 'Settings', icon: Settings },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const router = useRouter()

    const handleLogout = async () => {
        localStorage.removeItem('invoice_session_id')
        const supabase = createClient()
        await supabase.auth.signOut()
        router.push('/login')
        router.refresh()
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-950 dark:to-neutral-900">
            <div className="container mx-auto px-4 py-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <Link href="/">
                            <Button variant="ghost" size="sm">
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                App
                            </Button>
                        </Link>
                        <h1 className="text-xl font-bold">Admin Panel</h1>
                    </div>
                    <Button variant="ghost" size="sm" onClick={handleLogout}>
                        <LogOut className="h-4 w-4 mr-2" />
                        Logout
                    </Button>
                </div>

                {/* Nav */}
                <div className="flex gap-2 mb-8 flex-wrap">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href
                        return (
                            <Link key={item.href} href={item.href}>
                                <Button
                                    variant={isActive ? 'default' : 'outline'}
                                    size="sm"
                                    className="gap-2"
                                >
                                    <item.icon className="h-4 w-4" />
                                    {item.label}
                                </Button>
                            </Link>
                        )
                    })}
                </div>

                {children}
            </div>
        </div>
    )
}
