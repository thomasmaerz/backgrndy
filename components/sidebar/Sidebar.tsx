'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UploadCloud, Sparkles, Database, ChevronLeft, ChevronRight } from 'lucide-react'
import { useSidebar } from '@/lib/sidebar-context'

interface SidebarProps {
  staged: number
  enriched: number
}

const navItems = [
  { href: '/upload', label: 'Upload', icon: UploadCloud },
  { href: '/enrich', label: 'Enrich', icon: Sparkles },
  { href: '/library', label: 'Library', icon: Database },
]

export function Sidebar({ staged, enriched }: SidebarProps) {
  const pathname = usePathname()
  const { expanded, toggle } = useSidebar()
  
  return (
    <aside
      className={`fixed top-0 left-0 h-full bg-bg-surface border-r border-bg-border flex flex-col transition-all duration-200 z-40`}
      style={{ width: expanded ? '220px' : '64px' }}
    >
      <div className="flex-1 py-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          const Icon = item.icon
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 mx-2 rounded-lg transition-all duration-200
                ${isActive 
                  ? 'bg-accent-muted border-l-2 border-accent text-text-base' 
                  : 'text-text-muted hover:text-text-base hover:bg-bg-border'
                }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {expanded && (
                <span className="text-sm font-medium truncate">{item.label}</span>
              )}
            </Link>
          )
        })}
      </div>
      
      <div className="border-t border-bg-border p-4">
        {expanded ? (
          <div className="flex justify-between text-xs text-text-muted">
            <span>{staged} staged</span>
            <span>{enriched} enriched</span>
          </div>
        ) : (
          <div className="flex flex-col gap-1 text-xs text-text-muted">
            <span className="text-center">{staged}</span>
            <span className="text-center">{enriched}</span>
          </div>
        )}
        
        <button
          onClick={toggle}
          className="mt-3 w-full flex items-center justify-center p-2 rounded-lg text-text-muted hover:text-text-base hover:bg-bg-border transition-colors"
        >
          {expanded ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  )
}
