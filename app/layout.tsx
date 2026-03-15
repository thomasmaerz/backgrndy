import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import '@/lib/config'; // Validate env vars on startup
import './globals.css';

export const dynamic = 'force-dynamic';

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createSupabaseServerClient();

  const [{ count: bulletsCount }, { count: claimsCount }] = await Promise.all([
    supabase
      .from('rm_bullets_staging')
      .select('*', { count: 'exact', head: true })
      .eq('is_duplicate', false),
    supabase
      .from('rm_claims')
      .select('*', { count: 'exact', head: true })
      .eq('enrichment_status', 'enriched'),
  ]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50">
        <nav className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-8">
              <Link href="/" className="text-xl font-bold text-gray-900">
                ResumeMuncher
              </Link>
              <div className="flex gap-6">
                <Link
                  href="/upload"
                  className="text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Upload
                </Link>
                <Link
                  href="/enrich"
                  className="text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Enrich
                </Link>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500">
                {bulletsCount || 0} bullets • {claimsCount || 0} claims
              </span>
            </div>
          </div>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
