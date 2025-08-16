'use client'

import { useState } from 'react'
import { Sidebar } from './sidebar'
import { Header } from './header'
import { ProtectedRoute } from '@/components/auth/protected-route'

interface DashboardLayoutProps {
  children: React.ReactNode
  title?: string
  requiredRole?: 'admin' | 'operator' | 'viewer'
}

export function DashboardLayout({ 
  children, 
  title, 
  requiredRole 
}: DashboardLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed)
  }

  return (
    <ProtectedRoute requiredRole={requiredRole}>
      <div className="flex h-screen bg-slate-50 dark:bg-slate-900">
        {/* Sidebar */}
        <Sidebar 
          isCollapsed={sidebarCollapsed} 
          onToggle={toggleSidebar} 
        />

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header title={title} />
          
          {/* Page content */}
          <main className="flex-1 overflow-y-auto p-6">
            <div className="max-w-7xl mx-auto">
              {children}
            </div>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  )
}