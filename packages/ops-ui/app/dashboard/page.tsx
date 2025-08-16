'use client'

import { useAuth } from '@/lib/auth/auth-context'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Activity, 
  Users, 
  Server, 
  TrendingUp, 
  Clock, 
  Shield,
  Database,
  Wifi
} from 'lucide-react'

export default function DashboardPage() {
  const { user } = useAuth()

  const stats = [
    {
      name: 'Active Connections',
      value: '1,234',
      change: '+12%',
      changeType: 'increase' as const,
      icon: Wifi,
    },
    {
      name: 'Server Uptime',
      value: '99.9%',
      change: '+0.1%',
      changeType: 'increase' as const,
      icon: Server,
    },
    {
      name: 'Data Transferred',
      value: '45.2 GB',
      change: '+18%',
      changeType: 'increase' as const,
      icon: Database,
    },
    {
      name: 'Response Time',
      value: '12ms',
      change: '-2ms',
      changeType: 'decrease' as const,
      icon: Clock,
    },
  ]

  const recentActivity = [
    {
      id: 1,
      type: 'connection',
      message: 'New WebSocket connection established',
      timestamp: '2 minutes ago',
      status: 'success',
    },
    {
      id: 2,
      type: 'error',
      message: 'Connection timeout on proxy server 2',
      timestamp: '5 minutes ago',
      status: 'error',
    },
    {
      id: 3,
      type: 'maintenance',
      message: 'Scheduled maintenance completed',
      timestamp: '1 hour ago',
      status: 'info',
    },
    {
      id: 4,
      type: 'security',
      message: 'New admin user logged in',
      timestamp: '2 hours ago',
      status: 'warning',
    },
  ]

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
      case 'error':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
      case 'info':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
    }
  }

  return (
    <DashboardLayout title="Dashboard">
      <div className="space-y-6">
        {/* Welcome Section */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              Welcome back, {user?.name}!
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
              Here's what's happening with your operations today.
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">
              <Shield className="w-3 h-3 mr-1" />
              System Healthy
            </Badge>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat) => {
            const Icon = stat.icon
            return (
              <Card key={stat.name} className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                      {stat.name}
                    </p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                      {stat.value}
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                </div>
                <div className="mt-4 flex items-center">
                  <span
                    className={`text-sm font-medium ${
                      stat.changeType === 'increase'
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {stat.change}
                  </span>
                  <span className="text-sm text-slate-600 dark:text-slate-400 ml-2">
                    from last period
                  </span>
                </div>
              </Card>
            )
          })}
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Recent Activity
              </h3>
              <Activity className="h-5 w-5 text-slate-400" />
            </div>
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start space-x-3">
                  <div
                    className={`w-2 h-2 rounded-full mt-2 ${getStatusColor(
                      activity.status
                    )}`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-900 dark:text-slate-100">
                      {activity.message}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {activity.timestamp}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Quick Actions */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Quick Actions
              </h3>
              <TrendingUp className="h-5 w-5 text-slate-400" />
            </div>
            <div className="space-y-3">
              <button className="w-full text-left p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                <div className="flex items-center space-x-3">
                  <Server className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      Server Status
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      View detailed server metrics
                    </p>
                  </div>
                </div>
              </button>
              
              <button className="w-full text-left p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                <div className="flex items-center space-x-3">
                  <Users className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      Connection Manager
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Manage active connections
                    </p>
                  </div>
                </div>
              </button>
              
              <button className="w-full text-left p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                <div className="flex items-center space-x-3">
                  <Database className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      System Logs
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      View system and error logs
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}