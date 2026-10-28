import { NextResponse, type NextRequest } from 'next/server'
import { convexAuthNextjsMiddleware, nextjsMiddlewareRedirect } from '@convex-dev/auth/nextjs/server'
import { fetchQuery } from 'convex/nextjs'
import { api } from './convex/_generated/api'

// Satu-satunya pintu akses halaman. Middleware Convex Auth juga meneruskan
// /api/auth (login, logout, refresh token) ke Convex sebelum handler ini jalan.
export default convexAuthNextjsMiddleware(
    async (request: NextRequest, { convexAuth }) => {
        const pathname = request.nextUrl.pathname

        // API route mengecek auth sendiri (lewat fungsi Convex)
        if (pathname.startsWith('/api')) return

        const isPublicRoute = pathname.startsWith('/login') || pathname.startsWith('/register')
        const token = await convexAuth.getToken()
        // Role & status selalu dibaca dari tabel users, tidak pernah dari token
        const access = token ? await fetchQuery(api.users.accessState, {}, { token }) : null

        // Belum login → /login (kecuali halaman publik)
        if (!access) {
            if (isPublicRoute) return
            const url = request.nextUrl.clone()
            url.pathname = '/login'
            url.search = ''
            // Hanya redirect relatif, cegah open redirect
            if (pathname.startsWith('/') && !pathname.startsWith('//')) {
                url.searchParams.set('redirect', pathname)
            }
            return NextResponse.redirect(url)
        }

        // Sudah login → jauhkan dari login/register
        if (isPublicRoute) return nextjsMiddlewareRedirect(request, '/')

        const isAdmin = access.role === 'admin'
        const isBlocked = access.account_status === 'suspended' || access.account_status === 'banned'

        // Akun suspended/banned (non-admin) → /blocked
        if (isBlocked && !isAdmin) {
            if (!pathname.startsWith('/blocked')) return nextjsMiddlewareRedirect(request, '/blocked')
            return
        }
        if (pathname.startsWith('/blocked')) return nextjsMiddlewareRedirect(request, '/')

        // /subscribe untuk semua user login; admin tidak perlu langganan
        if (pathname.startsWith('/subscribe')) {
            if (isAdmin) return nextjsMiddlewareRedirect(request, '/')
            return
        }

        // /admin/* hanya untuk admin
        if (pathname.startsWith('/admin')) {
            if (!isAdmin) return nextjsMiddlewareRedirect(request, '/')
            return
        }

        // Halaman lain (/, /history, /upload) butuh langganan aktif
        if (!access.has_active_subscription) return nextjsMiddlewareRedirect(request, '/subscribe')
    },
    // Sesi login bertahan 30 hari (logout otomatis saat idle tetap diatur SessionGuard)
    { cookieConfig: { maxAge: 60 * 60 * 24 * 30 } }
)

export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization)
         * - favicon.ico
         * - public files (images, etc.)
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
