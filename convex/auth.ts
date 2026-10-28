import { convexAuth } from '@convex-dev/auth/server'
import { Password } from '@convex-dev/auth/providers/Password'
import bcrypt from 'bcryptjs'
import type { DataModel } from './_generated/dataModel'

export const MIN_PASSWORD_LENGTH = 6

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
    providers: [
        Password<DataModel>({
            // Dipanggil di setiap flow. Hanya email & nama yang diambil dari
            // input; role dan status selalu default, jadi tidak bisa diisi
            // sendiri oleh orang yang mendaftar.
            profile(params) {
                const email = String(params.email ?? '').trim().toLowerCase()
                if (!email) throw new Error('Email wajib diisi')
                const name = typeof params.name === 'string' ? params.name.trim() : undefined
                return {
                    email,
                    ...(name ? { name } : {}),
                    role: 'user',
                    account_status: 'active',
                    created_at: new Date().toISOString(),
                }
            },
            // Sama dengan aturan Supabase lama (minimal 6 karakter)
            validatePasswordRequirements(password) {
                if (password.length < MIN_PASSWORD_LENGTH) {
                    throw new Error(`Password minimal ${MIN_PASSWORD_LENGTH} karakter`)
                }
            },
            // bcrypt, sama dengan Supabase Auth, supaya hash password yang
            // diimpor dari auth.users tetap bisa dipakai login. Versi sync:
            // versi async bcryptjs memakai setTimeout, yang ditolak di mutation.
            crypto: {
                hashSecret: async (password) => bcrypt.hashSync(password, 10),
                verifySecret: async (password, hash) => bcrypt.compareSync(password, hash),
            },
        }),
    ],
})
