'use client'

import { HTMLAttributes, useState } from 'react'

interface TooltipProps extends HTMLAttributes<HTMLDivElement> {
  content: string
  children: React.ReactNode
}

export function Tooltip({ className = '', content, children, ...props }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  
  return (
    <div 
      className="relative inline-block"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div 
          className={`absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded whitespace-nowrap ${className}`}
          {...props}
        >
          {content}
        </div>
      )}
    </div>
  )
}
