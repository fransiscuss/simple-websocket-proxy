'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  ChevronLeft,
  LayoutDashboard,
  Activity,
  Settings,
  Users,
  Shield,
  BarChart3,
  Database,
  Terminal,
  GitBranch,
  Globe,
  Wifi,
  FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth/auth-context'

interface SidebarItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  requiredRole?: 'admin' | 'operator' | 'viewer'
}

const sidebarItems: SidebarItem[] = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    name: 'Traffic Monitoring',
    href: '/traffic',
    icon: Wifi,
  },
  {
    name: 'Endpoints',
    href: '/endpoints',
    icon: Globe,
    requiredRole: 'operator',
  },
  {
    name: 'Real-time Monitoring',
    href: '/monitoring',
    icon: Activity,
  },
  {
    name: 'Analytics',
    href: '/analytics',
    icon: BarChart3,
  },
  {
    name: 'Connections',
    href: '/connections',
    icon: GitBranch,
  },
  {
    name: 'Database',
    href: '/database',
    icon: Database,
    requiredRole: 'operator',
  },
  {
    name: 'System Logs',
    href: '/logs',
    icon: Terminal,
    requiredRole: 'operator',
  },
  {
    name: 'Audit Logs',
    href: '/audit',
    icon: FileText,
    requiredRole: 'operator',
  },
  {
    name: 'User Management',
    href: '/users',
    icon: Users,
    requiredRole: 'admin',
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
    requiredRole: 'admin',
  },
]

interface SidebarProps {
  isCollapsed: boolean
  onToggle: () => void
}

export function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  const pathname = usePathname()
  const { user } = useAuth()

  // Filter items based on user role
  const visibleItems = sidebarItems.filter(item => {
    if (!item.requiredRole) return true
    if (!user) return false

    const roleHierarchy = {
      admin: 3,
      operator: 2,
      viewer: 1,
    }

    const userRoleLevel = roleHierarchy[user.role]
    const requiredRoleLevel = roleHierarchy[item.requiredRole]

    return userRoleLevel >= requiredRoleLevel
  })

  return (
    <div
      className={cn(
        'flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 transition-all duration-300',
        isCollapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
        {!isCollapsed && (
          <div className="flex items-center space-x-2">
            <Shield className="h-6 w-6 text-primary" />
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              Operations
            </span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="h-8 w-8"
        >
          <ChevronLeft
            className={cn(
              'h-4 w-4 transition-transform',
              isCollapsed && 'rotate-180'
            )}
          />
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2">
        <ul className="space-y-1">
          {visibleItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            const Icon = item.icon

            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800',
                    isCollapsed && 'justify-center'
                  )}
                  title={isCollapsed ? item.name : undefined}
                >
                  <Icon className={cn('h-5 w-5', isCollapsed ? 'mx-auto' : '')} />
                  {!isCollapsed && <span>{item.name}</span>}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-700">
        {!isCollapsed && (
          <div className="text-xs text-slate-500 dark:text-slate-400">
            <p>Operations Dashboard</p>
            <p>Version 1.0.0</p>
          </div>
        )}
      </div>
    </div>
  )
}