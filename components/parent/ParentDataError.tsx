"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface ParentDataErrorProps {
  title: string;
  description: string;
  retryLabel: string;
  onRetry: () => void;
}

export function ParentDataError({
  title,
  description,
  retryLabel,
  onRetry,
}: ParentDataErrorProps) {
  return (
    <Card className="border-destructive/25 bg-destructive/[0.04]">
      <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-destructive/10 text-destructive">
          <AlertCircle className="h-6 w-6" aria-hidden="true" />
        </span>
        <div>
          <h2 className="font-semibold text-foreground">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <Button type="button" variant="outline" className="min-h-11 gap-2" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          {retryLabel}
        </Button>
      </CardContent>
    </Card>
  );
}
