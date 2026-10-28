'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthActions } from '@convex-dev/auth/react'

export const SESSION_KEY = 'invoice_session_id'

// Dipanggil setelah login/daftar berhasil: catat sesi ini sebagai satu-satunya
// sesi aktif (SessionGuard me-logout perangkat lain) + riwayat login.
export async function registerSession() {
    const sessionId = crypto.randomUUID()
    localStorage.setItem(SESSION_KEY, sessionId)

    await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            session_id: sessionId,
            device_info: navigator.userAgent,
        }),
    })
}

export function useLogout() {
    const router = useRouter()
    const { signOut } = useAuthActions()

    return useCallback(async () => {
        localStorage.removeItem(SESSION_KEY)
        await signOut()
        router.push('/login')
        router.refresh()
    }, [router, signOut])
}
