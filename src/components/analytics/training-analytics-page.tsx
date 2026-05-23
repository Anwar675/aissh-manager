"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { TrainingAnalyticsDashboard } from "@/components/analytics/training-analytics-dashboard";
import { LineHeader } from "@/components/dashboard/ui/line-header";

export function TrainingAnalyticsPage() {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 5,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <div className="py-4">
        <LineHeader title="ANALYTICS" />
        <TrainingAnalyticsDashboard />
      </div>
    </QueryClientProvider>
  );
}
