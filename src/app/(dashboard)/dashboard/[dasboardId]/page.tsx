"use client";
import { ActiveMachineCheck } from "@/components/dashboard/ui/active-machine-check";
import JobPanel from "@/components/dashboard/ui/job-paine";
import { LineHeader } from "@/components/dashboard/ui/line-header";
import { SectionCards } from "@/components/dashboard/ui/section-card";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

const Page = () => {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 5,
            refetchInterval: 3000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 pt-4 md:gap-6 md:pt-6">
            <LineHeader title="GPU METRICS" />
            <ActiveMachineCheck>
              <SectionCards />
              <JobPanel />
            </ActiveMachineCheck>
          </div>
        </div>
      </div>
    </QueryClientProvider>
  );
};

export default Page;
