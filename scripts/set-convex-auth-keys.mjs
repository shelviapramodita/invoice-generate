// Generate Convex Auth JWT keys and set them on the deployment linked in
// .env.local (run with cwd = project root). Secrets are never printed.
import { exportJWK, exportPKCS8, generateKeyPair } from 'jose'
import { execFileSync } from 'node:child_process'

const prod = process.argv.includes('--prod')
const siteUrl = process.argv.find((a) => a.startsWith('--site-url='))?.slice('--site-url='.length)

const keys = await generateKeyPair('RS256', { extractable: true })
const privateKey = await exportPKCS8(keys.privateKey)
const publicKey = await exportJWK(keys.publicKey)
const jwks = JSON.stringify({ keys: [{ use: 'sig', ...publicKey }] })

const set = (name, value) => {
    const args = ['convex', 'env', 'set', ...(prod ? ['--prod'] : []), name, '--', value]
    execFileSync('npx', args, { stdio: ['ignore', 'ignore', 'inherit'] })
    console.log(`set ${name}${prod ? ' (prod)' : ''}`)
}

set('JWT_PRIVATE_KEY', privateKey.trimEnd().replace(/\n/g, ' '))
set('JWKS', jwks)
if (siteUrl) set('SITE_URL', siteUrl)
