"use client";

import type { ReactNode } from "react";
import { IconServerOff } from "@tabler/icons-react";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useGpuMetrics } from "@/hooks/use-gpu-metrics";

type ActiveMachineCheckProps = {
  children: ReactNode;
};

export function ActiveMachineCheck({ children }: ActiveMachineCheckProps) {
  const { isLoading, isError, error } = useGpuMetrics();

  if (isLoading) {
    return (
      <div className="px-4 lg:px-6">
        <Card>
          <CardHeader>
            <CardTitle>Đang kiểm tra máy active...</CardTitle>
            <CardDescription>Đang kết nối tới máy đang được chọn.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="px-4 lg:px-6">
        <Card className="border-dashed">
          <CardHeader className="flex flex-row items-center gap-3">
            <IconServerOff className="size-8 text-muted-foreground" />
            <div>
              <CardTitle>Hiện không có máy nào active</CardTitle>
              <CardDescription>
                {error ?? "Chọn một máy làm active để xem GPU metrics."}
              </CardDescription>
            </div>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return children;
}
