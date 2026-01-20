import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!url || !key) {
        throw new Error('Supabase URL and Anon Key are required. Please create .env.local file.')
    }

    return createBrowserClient(url, key)
}

// Singleton instance for client-side usage
let supabaseInstance: ReturnType<typeof createBrowserClient> | null = null

export function getSupabase() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!url || !key) {
        console.warn('Supabase URL and Anon Key are required. Please create .env.local file.')
        return null
    }

    if (!supabaseInstance) {
        supabaseInstance = createBrowserClient(url, key)
    }
    return supabaseInstance
}
