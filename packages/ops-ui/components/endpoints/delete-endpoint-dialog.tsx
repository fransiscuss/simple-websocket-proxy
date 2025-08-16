"use client"

import * as React from "react"
import { Trash2 } from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { endpointApi } from "@/lib/api/endpoints"
import type { Endpoint } from "@/lib/types/endpoint"

interface DeleteEndpointDialogProps {
  endpoint: Endpoint
  onSuccess?: () => void
  children?: React.ReactNode
}

export function DeleteEndpointDialog({ 
  endpoint, 
  onSuccess, 
  children 
}: DeleteEndpointDialogProps) {
  const { toast } = useToast()
  const [isOpen, setIsOpen] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)

  const handleDelete = async () => {
    try {
      setIsDeleting(true)
      await endpointApi.delete(endpoint.id)
      
      toast({
        title: "Success",
        description: "Endpoint deleted successfully.",
      })
      
      setIsOpen(false)
      if (onSuccess) {
        onSuccess()
      }
    } catch (error) {
      console.error("Failed to delete endpoint:", error)
      toast({
        title: "Error",
        description: "Failed to delete endpoint. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm" className="text-red-600 hover:text-red-600">
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Endpoint</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete the endpoint "{endpoint.name}"?
            <br />
            <br />
            This action cannot be undone. All active connections will be terminated
            and all associated data will be permanently removed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
          >
            {isDeleting ? "Deleting..." : "Delete Endpoint"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}