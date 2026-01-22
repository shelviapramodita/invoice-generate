# AGENTS.md - Code Guidelines for Invoice Generator

## Build & Commands
- **Dev**: `npm run dev` (Next.js 16.1.4 with App Router on port 3000)
- **Build**: `npm run build` (production build)
- **Start**: `npm start` (run production build)
- **Lint**: `npm run lint` (ESLint 9 with Next.js config)
- **No test suite configured** (no Jest/Vitest/Playwright)

## Stack
- Next.js 16.1.4 (App Router), React 19.2.3, TypeScript 5 (strict mode)
- Supabase (@supabase/supabase-js + @supabase/ssr for DB + Storage)
- Form Handling: React Hook Form + @hookform/resolvers + Zod 4.3.5
- UI: Tailwind CSS 4, Radix UI, shadcn/ui components, lucide-react icons
- PDF: @react-pdf/renderer 4.3.2, pdf-lib 1.17.1
- File Parsing: xlsx 0.18.5, jszip 3.10.1
- State: Zustand 5.0.10, Date: date-fns 4.1.0

## Code Style
- **Imports**: Use `@/*` path aliases (e.g., `@/lib/utils`, `@/types`, `@/components/ui/button`)
- **Types**: Define in `/types/index.ts`. Use TypeScript strict mode. Prefer `interface` for objects, `type` for unions/utility types
- **Components**: React Server Components by default. Add `'use client'` directive ONLY when using hooks, event handlers, or browser APIs
- **Naming**: camelCase for variables/functions, PascalCase for components/types/interfaces, kebab-case for file names
- **API Routes**: `/app/api/*/route.ts` - export named async functions (GET/POST/DELETE). Always return `NextResponse.json({ ... }, { status })`
- **Error Handling**: Wrap in try-catch. Console.log with `[Context]` prefix. Return 400 for validation, 500 for server errors with `{ error: string, message?: string }` structure
- **DB Queries**: Centralize all Supabase queries in `/lib/db/queries.ts`. Use server-side client from `@/lib/supabase/server`. Never import Supabase client directly in components
- **Validation**: Define Zod schemas in `/lib/validators.ts`. Use `z.preprocess()` for transforms. Indonesian error messages OK for user-facing validation
- **Comments**: JSDoc for exported functions. Inline comments for business logic only. No obvious comments
- **Async/Await**: Always use try-catch with descriptive errors. Prefer async/await over `.then()`. Use `Promise.all()` for parallel operations
- **Formatting**: 4-space indentation (per tsconfig), single quotes for strings, no semicolons optional (codebase uses them inconsistently)
