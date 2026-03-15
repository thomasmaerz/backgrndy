const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'GEMINI_API_KEY',
];

const missing: string[] = [];

for (const key of requiredEnvVars) {
  if (!process.env[key]) {
    missing.push(key);
  }
}

if (missing.length > 0) {
  throw new Error(
    `Missing required environment variables:\n${missing.join('\n')}\n\n` +
    `Please set these in your .env.local file.`
  );
}

export const config = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  geminiApiKey: process.env.GEMINI_API_KEY!,
  aiProvider: process.env.AI_PROVIDER || 'gemini',
};
