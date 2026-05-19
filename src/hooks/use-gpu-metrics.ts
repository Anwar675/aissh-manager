"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";

type GPUMetric = {
  name: string;
  memoryUsed: number;
  memoryTotal: number;
  temperature: number;
  power: number;
  utilization: number;
};

async function fetchGpuMetrics(sshId?: string): Promise<GPUMetric[]> {
  const endpoint = sshId
    ? `/api/metrics/gpu?sshId=${encodeURIComponent(sshId)}`
    : "/api/metrics/gpu";
  const res = await fetch(endpoint, {
    cache: "no-store",
  });

  const json = await res.json();

  // backend trả lỗi đẹp
  if (!json.success) {
    throw new Error(
      json.error ??
        "Failed to fetch GPU metrics"
    );
  }

  return json.data;
}

export function useGpuMetrics() {
  const params = useParams<{ dasboardId?: string }>();
  const sshId = params.dasboardId;

  const query = useQuery({
    queryKey: ["gpu-metrics", sshId],

    queryFn: () => fetchGpuMetrics(sshId),

    refetchInterval: (query) =>
      query.state.error
        ? 10000
        : 3000,

    retry: false,

    refetchOnWindowFocus: false,
  });

  return {
    gpu: query.data?.[0],

    isLoading:
      query.isLoading,

    isError:
      query.isError,

    error:
      query.error instanceof Error
        ? query.error.message
        : null,
  };
}
