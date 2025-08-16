'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth/auth-context'

export default function UnauthorizedPage() {
  const router = useRouter()
  const { user, isAuthenticated } = useAuth()

  useEffect(() => {
    // Redirect to login if not authenticated
    if (!isAuthenticated) {
      router.push('/login')
    }
  }, [isAuthenticated, router])

  const handleGoBack = () => {
    router.back()
  }

  const handleGoToDashboard = () => {
    router.push('/dashboard')
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
      <div className="w-full max-w-md text-center">
        {/* Icon */}
        <div className="mx-auto h-16 w-16 bg-red-100 dark:bg-red-900/20 rounded-2xl flex items-center justify-center mb-6">
          <Shield className="h-8 w-8 text-red-600 dark:text-red-400" />
        </div>

        {/* Content */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 p-6">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            Access Denied
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            You don't have the required permissions to access this page.
          </p>
          
          {user && (
            <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3 mb-6">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Current role: <span className="font-medium text-slate-900 dark:text-slate-100 capitalize">{user.role}</span>
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Signed in as: <span className="font-medium text-slate-900 dark:text-slate-100">{user.email}</span>
              </p>
            </div>
          )}

          <div className="space-y-3">
            <Button onClick={handleGoToDashboard} className="w-full">
              Go to Dashboard
            </Button>
            <Button variant="outline" onClick={handleGoBack} className="w-full">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go Back
            </Button>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Contact your administrator if you believe this is an error.
          </p>
        </div>
      </div>
    </div>
  )
}