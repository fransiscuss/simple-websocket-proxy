import { EndpointForm } from "@/components/endpoints/endpoint-form"

export default function NewEndpointPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Create Endpoint</h1>
        <p className="text-muted-foreground">
          Create a new WebSocket proxy endpoint with custom configuration.
        </p>
      </div>

      <EndpointForm />
    </div>
  )
}