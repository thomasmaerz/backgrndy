interface Config {
  supabase: {
    url: string
    anonKey: string
    serviceRoleKey: string
  }
  ai: {
    provider: string
    geminiApiKey: string
  }
}

export function getConfig(): Config {
  const missing: string[] = []
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const geminiApiKey = process.env.GEMINI_API_KEY
  
  if (!supabaseUrl) missing.push('NEXT_PUBLIC_SUPABASE_URL')
  if (!supabaseAnonKey) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  if (!serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY')
  if (!geminiApiKey) missing.push('GEMINI_API_KEY')
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }
  
  return {
    supabase: {
      url: supabaseUrl!,
      anonKey: supabaseAnonKey!,
      serviceRoleKey: serviceRoleKey!,
    },
    ai: {
      provider: process.env.AI_PROVIDER || 'gemini',
      geminiApiKey: geminiApiKey!,
    },
  }
}
