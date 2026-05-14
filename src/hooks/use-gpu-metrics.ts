"use client";

import { useQuery } from "@tanstack/react-query";

type GPUMetric = {
  name: string;
  memoryUsed: number;
  memoryTotal: number;
  temperature: number;
  power: number;
  utilization: number;
};

async function fetchGpuMetrics(): Promise<
  GPUMetric[]
> {
  const res = await fetch(
    "/api/metrics/gpu",
    {
      cache: "no-store",
    }
  );

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
  const query = useQuery({
    queryKey: ["gpu-metrics"],

    queryFn: fetchGpuMetrics,

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