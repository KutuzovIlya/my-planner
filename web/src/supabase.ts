import { createClient } from '@supabase/supabase-js'

// Публичные адрес и ключ проекта: ключ «anon» предназначен для браузера,
// доступ к данным ограничен правилами RLS в базе (каждый видит только свои дела).
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabaseConfigured = !!(url && key)

export const supabase = createClient(url ?? 'http://localhost', key ?? 'missing', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'planner.auth' },
})
