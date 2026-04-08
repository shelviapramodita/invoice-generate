'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

const SESSION_KEY = 'invoice_session_id'
const POLL_INTERVAL = 30_000
const IDLE_TIMEOUT = 15 * 60 * 1000
const IDLE_WARNING = 13 * 60 * 1000

export function SessionGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter()
    const pathname = usePathname()
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const [kicked, setKicked] = useState(false)
    const warningShownRef = useRef(false)

    const isPublicRoute = pathname === '/login' || pathname === '/register'

    const forceLogout = useCallback(async (message: string, delay = 2000) => {
        setKicked(true)
        localStorage.removeItem(SESSION_KEY)
        toast.error(message, { duration: 5000 })
        setTimeout(async () => {
            const supabase = createClient()
            await supabase.auth.signOut()
            router.push('/login')
            router.refresh()
        }, delay)
    }, [router])

    useEffect(() => {
        if (isPublicRoute || kicked) return

        const checkSession = async () => {
            const localSessionId = localStorage.getItem(SESSION_KEY)
            if (!localSessionId) return

            try {
                const res = await fetch('/api/session')
                if (!res.ok) return

                const data = await res.json()
                if (!data.success) return

                if (data.active_session_id && data.active_session_id !== localSessionId) {
                    forceLogout('Akun Anda login dari perangkat lain. Anda akan logout dari sesi ini.')
                }
            } catch {
                // Network error, skip
            }
        }

        checkSession()
        intervalRef.current = setInterval(checkSession, POLL_INTERVAL)

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current)
        }
    }, [isPublicRoute, kicked, forceLogout])

    useEffect(() => {
        if (isPublicRoute || kicked) return

        const resetIdle = () => {
            warningShownRef.current = false
            if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
            if (warningTimerRef.current) clearTimeout(warningTimerRef.current)

            warningTimerRef.current = setTimeout(() => {
                warningShownRef.current = true
                toast.warning('Anda akan logout otomatis dalam 2 menit karena tidak aktif.', {
                    duration: 10000,
                })
            }, IDLE_WARNING)

            idleTimerRef.current = setTimeout(() => {
                forceLogout('Anda telah logout otomatis karena tidak aktif selama 15 menit.')
            }, IDLE_TIMEOUT)
        }

        const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'mousemove']
        let lastReset = 0
        const throttledReset = () => {
            const now = Date.now()
            if (now - lastReset > 30000) {
                lastReset = now
                resetIdle()
            }
        }

        events.forEach(event => window.addEventListener(event, throttledReset, { passive: true }))
        resetIdle()

        return () => {
            events.forEach(event => window.removeEventListener(event, throttledReset))
            if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
            if (warningTimerRef.current) clearTimeout(warningTimerRef.current)
        }
    }, [isPublicRoute, kicked, forceLogout])

    return <>{children}</>
}
