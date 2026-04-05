'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, CreditCard, Clock, CheckCircle } from 'lucide-react'

interface Stats {
    totalUsers: number
    activeSubscriptions: number
    pendingSubscriptions: number
    totalRevenue: number
}

export default function AdminDashboard() {
    const [stats, setStats] = useState<Stats>({
        totalUsers: 0,
        activeSubscriptions: 0,
        pendingSubscriptions: 0,
        totalRevenue: 0,
    })
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchStats() {
            try {
                const [usersRes, subsRes, settingsRes] = await Promise.all([
                    fetch('/api/admin/users'),
                    fetch('/api/admin/subscriptions'),
                    fetch('/api/admin/settings'),
                ])

                const users = await usersRes.json()
                const subs = await subsRes.json()
                const settings = await settingsRes.json()

                const allSubs = subs.data || []
                const price = settings.data?.price || 0

                setStats({
                    totalUsers: users.data?.length || 0,
                    activeSubscriptions: allSubs.filter((s: any) => s.status === 'active').length,
                    pendingSubscriptions: allSubs.filter((s: any) => s.status === 'pending').length,
                    totalRevenue: allSubs.filter((s: any) => s.status === 'active').length * price,
                })
            } catch (error) {
                console.error('Error fetching stats:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchStats()
    }, [])

    const cards = [
        {
            title: 'Total Users',
            value: stats.totalUsers,
            icon: Users,
            color: 'text-blue-600',
            bg: 'bg-blue-50',
        },
        {
            title: 'Active Subscriptions',
            value: stats.activeSubscriptions,
            icon: CheckCircle,
            color: 'text-green-600',
            bg: 'bg-green-50',
        },
        {
            title: 'Pending Approval',
            value: stats.pendingSubscriptions,
            icon: Clock,
            color: 'text-yellow-600',
            bg: 'bg-yellow-50',
        },
        {
            title: 'Est. Revenue',
            value: new Intl.NumberFormat('id-ID', {
                style: 'currency',
                currency: 'IDR',
                minimumFractionDigits: 0,
            }).format(stats.totalRevenue),
            icon: CreditCard,
            color: 'text-purple-600',
            bg: 'bg-purple-50',
        },
    ]

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold">Dashboard</h2>

            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {cards.map((card) => (
                        <Card key={card.title} className="shadow-sm">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">
                                    {card.title}
                                </CardTitle>
                                <div className={`h-8 w-8 rounded-lg ${card.bg} flex items-center justify-center`}>
                                    <card.icon className={`h-4 w-4 ${card.color}`} />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{card.value}</div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
