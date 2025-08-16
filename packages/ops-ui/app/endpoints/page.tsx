"use client"

import * as React from "react"
import { ColumnDef, PaginationState } from "@tanstack/react-table"
import { ArrowUpDown, MoreHorizontal, Plus, Eye, Edit, Trash2, Power, PowerOff, Copy } from "lucide-react"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DataTable } from "@/components/ui/data-table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from "@/components/ui/use-toast"
import { DeleteEndpointDialog } from "@/components/endpoints/delete-endpoint-dialog"
import { endpointApi } from "@/lib/api/endpoints"
import type { EndpointTableRow, EndpointAction } from "@/lib/types/endpoint"

export default function EndpointsPage() {
  const { toast } = useToast()
  const [endpoints, setEndpoints] = React.useState<EndpointTableRow[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })
  const [pageCount, setPageCount] = React.useState(0)
  const [searchTerm, setSearchTerm] = React.useState("")

  const loadEndpoints = React.useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await endpointApi.list({
        page: pagination.pageIndex + 1,
        limit: pagination.pageSize,
        search: searchTerm || undefined,
        sortBy: 'name',
        sortOrder: 'asc',
      })

      // Transform endpoints to table rows with additional UI state
      const endpointRows: EndpointTableRow[] = response.endpoints.map(endpoint => ({
        ...endpoint,
        activeConnections: 0, // This would come from real-time data
        totalConnections: 0,  // This would come from stats API
        lastActivity: null,   // This would come from stats API
        status: endpoint.enabled ? 'online' : 'offline' as const,
      }))

      setEndpoints(endpointRows)
      setPageCount(Math.ceil(response.total / pagination.pageSize))
    } catch (error) {
      console.error('Failed to load endpoints:', error)
      toast({
        title: "Error",
        description: "Failed to load endpoints. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [pagination.pageIndex, pagination.pageSize, searchTerm, toast])

  React.useEffect(() => {
    loadEndpoints()
  }, [loadEndpoints])

  const handleAction = async (action: EndpointAction, endpoint: EndpointTableRow) => {
    try {
      switch (action) {
        case 'enable':
        case 'disable':
          await endpointApi.setEnabled(endpoint.id, action === 'enable')
          toast({
            title: "Success",
            description: `Endpoint ${action === 'enable' ? 'enabled' : 'disabled'} successfully.`,
          })
          loadEndpoints()
          break
        case 'clone':
          const newName = `${endpoint.name} (Copy)`
          await endpointApi.clone(endpoint.id, newName)
          toast({
            title: "Success",
            description: "Endpoint cloned successfully.",
          })
          loadEndpoints()
          break
      }
    } catch (error) {
      console.error(`Failed to ${action} endpoint:`, error)
      toast({
        title: "Error",
        description: `Failed to ${action} endpoint. Please try again.`,
        variant: "destructive",
      })
    }
  }

  const columns: ColumnDef<EndpointTableRow>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Name
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => (
        <div className="font-medium">
          <Link 
            href={`/endpoints/${row.original.id}`}
            className="hover:underline"
          >
            {row.getValue("name")}
          </Link>
        </div>
      ),
    },
    {
      accessorKey: "targetUrl",
      header: "Target URL",
      cell: ({ row }) => {
        const url = row.getValue("targetUrl") as string
        return (
          <div className="max-w-xs truncate" title={url}>
            {url}
          </div>
        )
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("status") as string
        const enabled = row.original.enabled
        
        return (
          <Badge 
            variant={enabled ? (status === 'online' ? 'default' : 'secondary') : 'outline'}
            className={enabled ? (status === 'online' ? 'bg-green-100 text-green-800' : '') : ''}
          >
            {enabled ? (status === 'online' ? 'Online' : 'Offline') : 'Disabled'}
          </Badge>
        )
      },
    },
    {
      accessorKey: "activeConnections",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Active Connections
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        const count = row.getValue("activeConnections") as number
        return <div className="text-center">{count || 0}</div>
      },
    },
    {
      accessorKey: "totalConnections",
      header: "Total Connections",
      cell: ({ row }) => {
        const count = row.getValue("totalConnections") as number
        return <div className="text-center">{count || 0}</div>
      },
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Created
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        const date = new Date(row.getValue("createdAt"))
        return <div>{date.toLocaleDateString()}</div>
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const endpoint = row.original

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={`/endpoints/${endpoint.id}`}>
                  <Eye className="mr-2 h-4 w-4" />
                  View Details
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/endpoints/${endpoint.id}/edit`}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleAction('clone', endpoint)}>
                <Copy className="mr-2 h-4 w-4" />
                Clone
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => handleAction(endpoint.enabled ? 'disable' : 'enable', endpoint)}
              >
                {endpoint.enabled ? (
                  <>
                    <PowerOff className="mr-2 h-4 w-4" />
                    Disable
                  </>
                ) : (
                  <>
                    <Power className="mr-2 h-4 w-4" />
                    Enable
                  </>
                )}
              </DropdownMenuItem>
              <DeleteEndpointDialog 
                endpoint={endpoint} 
                onSuccess={loadEndpoints}
              >
                <DropdownMenuItem 
                  onSelect={(e) => e.preventDefault()}
                  className="text-red-600 focus:text-red-600"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DeleteEndpointDialog>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]

  const handleSearch = React.useCallback(
    (value: string) => {
      setSearchTerm(value)
      setPagination(prev => ({ ...prev, pageIndex: 0 }))
    },
    []
  )

  // Debounce search
  React.useEffect(() => {
    const timer = setTimeout(() => {
      loadEndpoints()
    }, 300)

    return () => clearTimeout(timer)
  }, [searchTerm])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Endpoints</h1>
          <p className="text-muted-foreground">
            Manage WebSocket proxy endpoints and their configurations.
          </p>
        </div>
        <Button asChild>
          <Link href="/endpoints/new">
            <Plus className="mr-2 h-4 w-4" />
            Create Endpoint
          </Link>
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Endpoints</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{endpoints.length}</div>
            <p className="text-xs text-muted-foreground">
              Across all configurations
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Endpoints</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {endpoints.filter(e => e.enabled).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Currently enabled
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Connections</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {endpoints.reduce((sum, e) => sum + (e.activeConnections || 0), 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Active connections
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">99.2%</div>
            <p className="text-xs text-muted-foreground">
              Last 24 hours
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>Endpoints</CardTitle>
          <CardDescription>
            A list of all configured WebSocket proxy endpoints.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={endpoints}
            searchKey="name"
            searchPlaceholder="Search endpoints..."
            pagination={pagination}
            onPaginationChange={setPagination}
            pageCount={pageCount}
            isLoading={isLoading}
            emptyMessage="No endpoints found. Create your first endpoint to get started."
          />
        </CardContent>
      </Card>
    </div>
  )
}