"use client"

import * as React from "react"
import { useParams } from "next/navigation"

import { EndpointForm } from "@/components/endpoints/endpoint-form"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/use-toast"
import { endpointApi } from "@/lib/api/endpoints"
import type { Endpoint } from "@/lib/types/endpoint"

export default function EditEndpointPage() {
  const params = useParams()
  const { toast } = useToast()
  const [endpoint, setEndpoint] = React.useState<Endpoint | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const endpointId = params.id as string

  React.useEffect(() => {
    const loadEndpoint = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const response = await endpointApi.get(endpointId)
        setEndpoint(response.endpoint)
      } catch (error) {
        console.error("Failed to load endpoint:", error)
        setError("Failed to load endpoint")
        toast({
          title: "Error",
          description: "Failed to load endpoint. Please try again.",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    if (endpointId) {
      loadEndpoint()
    }
  }, [endpointId, toast])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96 mt-2" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    )
  }

  if (error || !endpoint) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-destructive">Error</h1>
          <p className="text-muted-foreground">
            {error || "Endpoint not found"}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Edit Endpoint</h1>
        <p className="text-muted-foreground">
          Update the configuration for "{endpoint.name}".
        </p>
      </div>

      <EndpointForm endpoint={endpoint} />
    </div>
  )
}