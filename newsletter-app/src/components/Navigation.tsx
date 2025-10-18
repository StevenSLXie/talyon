'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Navigation() {
  const pathname = usePathname()

  const navItems = [
    { href: '/', label: 'Find Jobs', active: pathname === '/' },
    { href: '/articles', label: 'Articles', active: pathname.startsWith('/articles') },
  ]

  return (
    <nav className="hidden md:flex items-center space-x-8">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`text-sm font-medium transition-colors ${
            item.active
              ? 'text-black border-b-2 border-black pb-1'
              : 'text-gray-600 hover:text-black'
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  )
}
