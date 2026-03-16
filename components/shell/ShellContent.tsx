'use client'

import { useSidebar } from '@/lib/sidebar-context'
import { Sidebar } from '@/components/sidebar/Sidebar'

interface ShellContentProps {
  staged: number
  enriched: number
  children: React.ReactNode
}

export function ShellContent({ staged, enriched, children }: ShellContentProps) {
  const { expanded } = useSidebar()
  
  return (
    <>
      <Sidebar staged={staged} enriched={enriched} />
      <main
        className={`min-h-screen transition-all duration-200 pt-4 px-6 pb-8`}
        style={{ marginLeft: expanded ? '220px' : '64px' }}
      >
        {children}
      </main>
    </>
  )
}
