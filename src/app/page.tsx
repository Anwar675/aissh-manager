"use client";
import JobPanel from "@/components/dashboard/ui/job-paine";
import { LineHeader } from "@/components/dashboard/ui/line-header";
import { SectionCards } from "@/components/dashboard/ui/section-card";
import { SiteHeader } from "@/components/dashboard/ui/side-headr";
import { AppSidebar } from "@/components/ui/app-sidebar";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

const Page = () => {
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <LineHeader title="GPU METRICS" />
              <SectionCards />
              
              <JobPanel />
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default Page;
