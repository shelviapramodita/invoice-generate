import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({ request })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    )
                    supabaseResponse = NextResponse.next({ request })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // IMPORTANT: Do not run code between createServerClient and
    // supabase.auth.getUser(). A simple mistake could make it very hard to debug
    // issues with users being randomly logged out.
    const {
        data: { user },
    } = await supabase.auth.getUser()

    const pathname = request.nextUrl.pathname

    // Public routes - no auth required
    const publicRoutes = ['/login', '/register']
    const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))

    // Auth callback route
    if (pathname.startsWith('/auth/callback')) {
        return supabaseResponse
    }

    // API routes - let them handle their own auth
    if (pathname.startsWith('/api')) {
        return supabaseResponse
    }

    // Not logged in → redirect to login (except public routes)
    if (!user) {
        if (isPublicRoute) return supabaseResponse
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        url.searchParams.set('redirect', pathname)
        return NextResponse.redirect(url)
    }

    // Logged in → redirect away from login/register
    if (isPublicRoute) {
        const url = request.nextUrl.clone()
        url.pathname = '/'
        return NextResponse.redirect(url)
    }

    // Get user profile with error logging
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    console.log('[Middleware]', pathname, '| user:', user.email, '| profile:', profile, '| error:', profileError?.message)

    // If profile query fails (RLS issue), try to determine role from user metadata
    const userRole = profile?.role || user.user_metadata?.role

    // /subscribe route → accessible to all authenticated users
    if (pathname.startsWith('/subscribe')) {
        // If admin, redirect to home (admins don't need subscription)
        if (userRole === 'admin') {
            const url = request.nextUrl.clone()
            url.pathname = '/'
            return NextResponse.redirect(url)
        }
        return supabaseResponse
    }

    // Admin routes → must be admin
    if (pathname.startsWith('/admin')) {
        if (userRole !== 'admin') {
            const url = request.nextUrl.clone()
            url.pathname = '/'
            return NextResponse.redirect(url)
        }
        return supabaseResponse
    }

    // Protected routes (/, /history, /upload) → need active subscription
    // Admins bypass subscription check
    if (userRole === 'admin') {
        return supabaseResponse
    }

    // Check active subscription
    const { data: subscription } = await supabase
        .from('subscriptions')
        .select('status, expires_at')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .gte('expires_at', new Date().toISOString())
        .order('expires_at', { ascending: false })
        .limit(1)
        .single()

    if (!subscription) {
        const url = request.nextUrl.clone()
        url.pathname = '/subscribe'
        return NextResponse.redirect(url)
    }

    return supabaseResponse
}
