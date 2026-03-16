import { createClient } from '@supabase/supabase-js'
import { getConfig } from '@/lib/config'

export function createServerClient() {
  const config = getConfig()
  return createClient(config.supabase.url, config.supabase.serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  })
}
