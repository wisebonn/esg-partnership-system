import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Shared browser singleton — safe to import anywhere client-side.
// Lazy-initialised so it is never constructed during SSR/prerender.
let _client: ReturnType<typeof createClient> | null = null

export function getSupabase() {
  if (!_client) _client = createClient()
  return _client
}

// Convenience alias used by utils & pages: `import { supabase } from '@/utils/supabase'`
// NOTE: getter-backed proxy so it is only constructed on first property access,
// which happens client-side, never during module evaluation on the server.
export const supabase = new Proxy({} as ReturnType<typeof createClient>, {
  get(_target, prop, receiver) {
    const client = getSupabase()
    const value = Reflect.get(client as object, prop, receiver)
    return typeof value === 'function' ? value.bind(client) : value
  },
})