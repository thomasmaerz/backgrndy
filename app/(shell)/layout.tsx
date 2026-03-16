import { Suspense } from 'react'
import { SidebarProvider } from '@/lib/sidebar-context'
import { ShellContent } from '@/components/shell/ShellContent'
import { createServerClient } from '@/lib/supabase/server'

async function getSidebarStats() {
  try {
    const supabase = createServerClient()
    
    const [stagingResult, claimsResult] = await Promise.all([
      supabase.from('rmc_experience_staging').select('id', { count: 'exact', head: true }),
      supabase.from('rmc_claims').select('id', { count: 'exact', head: true }),
    ])
    
    return {
      staged: stagingResult.count || 0,
      enriched: claimsResult.count || 0,
    }
  } catch (error) {
    console.error('Error fetching sidebar stats:', error)
    return { staged: 0, enriched: 0 }
  }
}

export default async function ShellLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const stats = await getSidebarStats()
  
  return (
    <SidebarProvider>
      <ShellContent staged={stats.staged} enriched={stats.enriched}>
        {children}
      </ShellContent>
    </SidebarProvider>
  )
}
