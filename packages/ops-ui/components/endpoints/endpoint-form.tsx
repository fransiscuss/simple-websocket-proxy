"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { endpointApi } from "@/lib/api/endpoints"
import type { Endpoint, CreateEndpointRequest, UpdateEndpointRequest } from "@/lib/types/endpoint"

const endpointFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
  targetUrl: z.string().url("Must be a valid WebSocket URL").refine(
    (url) => url.startsWith("ws://") || url.startsWith("wss://"),
    "Must be a WebSocket URL (ws:// or wss://)"
  ),
  enabled: z.boolean().default(true),
  limits: z.object({
    maxConnections: z.number().int().positive().optional().or(z.literal(undefined)),
    maxMessageSize: z.number().int().positive().optional().or(z.literal(undefined)),
    connectionTimeoutMs: z.number().int().positive().optional().or(z.literal(undefined)),
    idleTimeoutMs: z.number().int().positive().optional().or(z.literal(undefined)),
    rateLimitRpm: z.number().int().positive().optional().or(z.literal(undefined)),
  }),
  sampling: z.object({
    enabled: z.boolean().default(false),
    sampleRate: z.number().min(0).max(1).optional().or(z.literal(undefined)),
    maxSampleSize: z.number().int().positive().optional().or(z.literal(undefined)),
    storeContent: z.boolean().default(false),
  }),
})

type EndpointFormValues = z.infer<typeof endpointFormSchema>

interface EndpointFormProps {
  endpoint?: Endpoint
  onSuccess?: () => void
}

export function EndpointForm({ endpoint, onSuccess }: EndpointFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = React.useState(false)
  const [isTesting, setIsTesting] = React.useState(false)

  const isEditing = !!endpoint

  const form = useForm<EndpointFormValues>({
    resolver: zodResolver(endpointFormSchema),
    defaultValues: endpoint
      ? {
          name: endpoint.name,
          targetUrl: endpoint.targetUrl,
          enabled: endpoint.enabled,
          limits: {
            maxConnections: endpoint.limits.maxConnections || undefined,
            maxMessageSize: endpoint.limits.maxMessageSize || undefined,
            connectionTimeoutMs: endpoint.limits.connectionTimeoutMs || undefined,
            idleTimeoutMs: endpoint.limits.idleTimeoutMs || undefined,
            rateLimitRpm: endpoint.limits.rateLimitRpm || undefined,
          },
          sampling: {
            enabled: endpoint.sampling.enabled,
            sampleRate: endpoint.sampling.sampleRate || undefined,
            maxSampleSize: endpoint.sampling.maxSampleSize || undefined,
            storeContent: endpoint.sampling.storeContent || false,
          },
        }
      : {
          name: "",
          targetUrl: "",
          enabled: true,
          limits: {
            maxConnections: undefined,
            maxMessageSize: undefined,
            connectionTimeoutMs: undefined,
            idleTimeoutMs: undefined,
            rateLimitRpm: undefined,
          },
          sampling: {
            enabled: false,
            sampleRate: undefined,
            maxSampleSize: undefined,
            storeContent: false,
          },
        },
  })

  const testConnection = async () => {
    const targetUrl = form.getValues("targetUrl")
    if (!targetUrl) {
      toast({
        title: "Error",
        description: "Please enter a target URL first.",
        variant: "destructive",
      })
      return
    }

    try {
      setIsTesting(true)
      const result = await endpointApi.testConnection(targetUrl)
      
      if (result.success) {
        toast({
          title: "Connection Successful",
          description: `Connected successfully${result.responseTime ? ` in ${result.responseTime}ms` : ""}.`,
        })
      } else {
        toast({
          title: "Connection Failed",
          description: result.message,
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Test Failed",
        description: "Unable to test connection. Please check the URL and try again.",
        variant: "destructive",
      })
    } finally {
      setIsTesting(false)
    }
  }

  const onSubmit = async (values: EndpointFormValues) => {
    try {
      setIsLoading(true)

      // Clean up undefined values while preserving structure
      const cleanLimits = Object.fromEntries(
        Object.entries(values.limits).filter(([_, value]) => value !== undefined)
      )
      
      // For sampling, keep the required 'enabled' field and filter others
      const cleanSampling = {
        enabled: values.sampling.enabled,
        ...(values.sampling.sampleRate !== undefined && { sampleRate: values.sampling.sampleRate }),
        ...(values.sampling.maxSampleSize !== undefined && { maxSampleSize: values.sampling.maxSampleSize }),
        ...(values.sampling.storeContent !== undefined && { storeContent: values.sampling.storeContent }),
      }

      const data = {
        name: values.name,
        targetUrl: values.targetUrl,
        enabled: values.enabled,
        limits: cleanLimits,
        sampling: cleanSampling,
      }

      if (isEditing && endpoint) {
        await endpointApi.update(endpoint.id, data as UpdateEndpointRequest)
        toast({
          title: "Success",
          description: "Endpoint updated successfully.",
        })
      } else {
        await endpointApi.create(data as CreateEndpointRequest)
        toast({
          title: "Success",
          description: "Endpoint created successfully.",
        })
      }

      if (onSuccess) {
        onSuccess()
      } else {
        router.push("/endpoints")
      }
    } catch (error) {
      console.error("Failed to save endpoint:", error)
      toast({
        title: "Error",
        description: `Failed to ${isEditing ? "update" : "create"} endpoint. Please try again.`,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Configuration</CardTitle>
              <CardDescription>
                Configure the basic settings for your WebSocket proxy endpoint.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="My WebSocket Endpoint" {...field} />
                    </FormControl>
                    <FormDescription>
                      A descriptive name for this endpoint.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="targetUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target URL</FormLabel>
                    <FormControl>
                      <div className="flex space-x-2">
                        <Input 
                          placeholder="wss://api.example.com/websocket" 
                          {...field} 
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={testConnection}
                          disabled={!field.value || isTesting}
                        >
                          {isTesting ? "Testing..." : "Test"}
                        </Button>
                      </div>
                    </FormControl>
                    <FormDescription>
                      The WebSocket URL to proxy connections to. Must start with ws:// or wss://.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="enabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Enabled</FormLabel>
                      <FormDescription>
                        Whether this endpoint should accept new connections.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Connection Limits */}
          <Card>
            <CardHeader>
              <CardTitle>Connection Limits</CardTitle>
              <CardDescription>
                Configure limits for connections and message handling.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="limits.maxConnections"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Connections</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="100"
                          {...field}
                          onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormDescription>
                        Maximum concurrent connections (optional).
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="limits.maxMessageSize"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Message Size (bytes)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="1048576"
                          {...field}
                          onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormDescription>
                        Maximum message size in bytes (optional).
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="limits.connectionTimeoutMs"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Connection Timeout (ms)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="30000"
                          {...field}
                          onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormDescription>
                        Connection timeout in milliseconds (optional).
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="limits.idleTimeoutMs"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Idle Timeout (ms)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="300000"
                          {...field}
                          onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormDescription>
                        Idle timeout in milliseconds (optional).
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="limits.rateLimitRpm"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rate Limit (requests/min)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="1000"
                          {...field}
                          onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormDescription>
                        Rate limit in requests per minute (optional).
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Sampling Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Sampling Configuration</CardTitle>
              <CardDescription>
                Configure traffic sampling for monitoring and debugging.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="sampling.enabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Enable Sampling</FormLabel>
                      <FormDescription>
                        Sample and store WebSocket traffic for analysis.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {form.watch("sampling.enabled") && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="sampling.sampleRate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sample Rate</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            max="1"
                            placeholder="0.1"
                            {...field}
                            onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormDescription>
                          Percentage of traffic to sample (0.0 to 1.0).
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="sampling.maxSampleSize"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Sample Size (bytes)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="4096"
                            {...field}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormDescription>
                          Maximum size of sampled messages in bytes.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {form.watch("sampling.enabled") && (
                <FormField
                  control={form.control}
                  name="sampling.storeContent"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Store Message Content</FormLabel>
                        <FormDescription>
                          Store the actual content of sampled messages (may impact performance).
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              )}
            </CardContent>
          </Card>

          {/* Form Actions */}
          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/endpoints")}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Saving..." : (isEditing ? "Update Endpoint" : "Create Endpoint")}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}