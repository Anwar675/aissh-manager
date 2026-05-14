import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Progress } from "@/components/ui/progress";
import { useGpuMetrics } from "@/hooks/use-gpu-metrics";
import { GoDotFill } from "react-icons/go";

export function SectionCards() {
  const { gpu, isLoading, isError, error } = useGpuMetrics();

  if (isLoading || !gpu) {
    return (
      <div>
        <p className="text-center text-gray-500">Loading GPU metrics...</p>
      </div>
    );
  }
  if (isError) {
    return (
      <div className="px-4">
        <Card className="border-red-500">
          <CardHeader>
            <CardTitle className="text-red-500">GPU Offline</CardTitle>

            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!gpu) {
    return <div>No GPU metrics</div>;
  }
  const vramPercent = (gpu.memoryUsed / gpu.memoryTotal) * 100;

  const tempPercent = Math.min((gpu.temperature / 100) * 100, 100);

  const powerPercent = Math.min((gpu.power / 220) * 100, 100);
  return (
    <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>VRAM</CardDescription>
          <CardTitle className="text-2xl font-semibold text-blue-400 tabular-nums @[250px]/card:text-3xl">
            {(gpu.memoryUsed / 1024).toFixed(1)} /{" "}
            <span className="text-xl text-gray-500">
              {" "}
              {(gpu.memoryTotal / 1024).toFixed(1)}GB
            </span>
          </CardTitle>
          <h3 className="text-gray-400">{vramPercent.toFixed(1)}% used</h3>
          <Progress value={vramPercent} className="bg-blue-400" />
        </CardHeader>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Temps</CardDescription>
          <CardTitle className="text-2xl font-semibold text-yellow-500 tabular-nums @[250px]/card:text-3xl">
            {gpu.temperature}°C
          </CardTitle>
          <div className="flex gap-2 items-center text-yellow-500">
            <GoDotFill />
            <p>
              {gpu.temperature > 80
                ? "Hot"
                : gpu.temperature > 60
                  ? "Warm"
                  : "Normal"}
            </p>
          </div>
          <Progress value={tempPercent} className="bg-yellow-500" />
        </CardHeader>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Power</CardDescription>
          <CardTitle className="text-2xl font-semibold text-red-500 tabular-nums @[250px]/card:text-3xl">
            {gpu.power.toFixed(0)}W
          </CardTitle>
          <div className="flex gap-2 items-center text-red-500">
            <GoDotFill />
            {gpu.power > 150 ? "High" : "Low"}
          </div>
          <Progress value={70} className="bg-red-500" />
        </CardHeader>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Util</CardDescription>
          <CardTitle className="text-2xl font-semibold text-green-500 tabular-nums @[250px]/card:text-3xl">
            {powerPercent.toFixed(1)}%
          </CardTitle>
          <div className="flex gap-2 items-center text-green-500">
            <GoDotFill />
            <p>Active</p>
          </div>
          <Progress value={powerPercent} className="bg-green-500" />
        </CardHeader>
      </Card>
    </div>
  );
}
