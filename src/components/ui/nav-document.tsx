"use client";

import * as React from "react";
import Link from "next/link";
import { GoDotFill } from "react-icons/go";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

type VmStatus = "active" | "idle" | "unavailable";

type NavDocumentItem = {
  title: string;
  url: string;
  status: VmStatus;
  count?: number;
};

const defaultItems: NavDocumentItem[] = [
  {
    title: "Active",
    url: "/dashboard",
    status: "active",
    count: 0,
  },
  {
    title: "Idle",
    url: "/dashboard",
    status: "idle",
    count: 0,
  },
  {
    title: "Not available",
    url: "/dashboard",
    status: "unavailable",
    count: 0,
  },
];

const statusClassName: Record<VmStatus, string> = {
  active: "text-green-500",
  idle: "text-yellow-500",
  unavailable: "text-red-500",
};

type SshSummary = {
  total: number;
  active: number;
  idle: number;
};

export function NavDocuments({
  items = defaultItems,
}: {
  items?: NavDocumentItem[];
}) {
  const [summary, setSummary] = React.useState<SshSummary>({
    total: 0,
    active: 0,
    idle: 0,
  });

  React.useEffect(() => {
    let isMounted = true;

    async function loadSummary() {
      try {
        const response = await fetch("/api/ssh", {
          cache: "no-store",
        });
        const payload = await response.json();

        if (!response.ok || !payload.success) {
          throw new Error(payload.error ?? "Failed to load SSH summary");
        }

        if (isMounted) {
          setSummary(payload.data);
        }
      } catch {
        if (isMounted) {
          setSummary({
            total: 0,
            active: 0,
            idle: 0,
          });
        }
      }
    }

    void loadSummary();

    const interval = window.setInterval(loadSummary, 5000);

    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, []);

  const documents = items.map((item) => {
    if (item.status === "active") {
      return {
        ...item,
        count: summary.active,
      };
    }

    if (item.status === "idle") {
      return {
        ...item,
        count: summary.idle,
      };
    }

    return item;
  });

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Active VM</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {documents.map((item) => (
            <SidebarMenuItem key={`${item.status}-${item.title}`}>
              <SidebarMenuButton asChild tooltip={item.title}>
                <Link href={item.url}>
                  <GoDotFill className={statusClassName[item.status]} />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
              {typeof item.count === "number" ? (
                <SidebarMenuBadge>{item.count}</SidebarMenuBadge>
              ) : null}
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
