import { createBrowserClient } from '@supabase/ssr'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'

export function createClient() {
  return createBrowserClient(URL, KEY)
}

export const supabase = createClient()
