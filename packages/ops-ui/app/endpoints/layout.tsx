import { ProtectedRoute } from "@/components/auth/protected-route"
import { DashboardLayout } from "@/components/layout/dashboard-layout"

export default function EndpointsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProtectedRoute requiredRole="operator">
      <DashboardLayout>
        {children}
      </DashboardLayout>
    </ProtectedRoute>
  )
}