'use client';

import { AuditLog } from '@/lib/types/audit';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface AuditLogDetailsDialogProps {
  log: AuditLog | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AuditLogDetailsDialog({
  log,
  open,
  onOpenChange,
}: AuditLogDetailsDialogProps) {
  if (!log) return null;

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const getActionBadgeVariant = (action: string) => {
    if (action.includes('CREATE')) return 'default';
    if (action.includes('UPDATE')) return 'secondary';
    if (action.includes('DELETE')) return 'destructive';
    if (action.includes('LOGIN')) return 'default';
    return 'outline';
  };

  const formatJsonValue = (value: any): string => {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return JSON.stringify(value, null, 2);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Audit Log Details
            <Badge variant={getActionBadgeVariant(log.action)}>
              {log.action}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    ID
                  </label>
                  <p className="font-mono text-sm">{log.id}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Timestamp
                  </label>
                  <p>{formatTimestamp(log.timestamp)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Action
                  </label>
                  <p>{log.action}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Entity Type
                  </label>
                  <p>{log.entityType}</p>
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    Entity ID
                  </label>
                  <p className="font-mono text-sm">{log.entityId}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Details */}
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent>
              {Object.keys(log.details).length === 0 ? (
                <p className="text-muted-foreground italic">No additional details</p>
              ) : (
                <div className="space-y-4">
                  {Object.entries(log.details).map(([key, value], index) => (
                    <div key={key}>
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-muted-foreground">
                          {key}
                        </label>
                      </div>
                      <div className="mt-1">
                        {typeof value === 'object' ? (
                          <pre className="bg-muted p-3 rounded-md text-sm overflow-x-auto">
                            <code>{JSON.stringify(value, null, 2)}</code>
                          </pre>
                        ) : (
                          <p className="text-sm">{formatJsonValue(value)}</p>
                        )}
                      </div>
                      {index < Object.entries(log.details).length - 1 && (
                        <Separator className="mt-4" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Raw JSON */}
          <Card>
            <CardHeader>
              <CardTitle>Raw JSON</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted p-4 rounded-md text-sm overflow-x-auto">
                <code>{JSON.stringify(log, null, 2)}</code>
              </pre>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}