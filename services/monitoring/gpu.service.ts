import { sshService } from "../ssh";

export type GPUMetric = {
  name: string;
  memoryUsed: number;
  memoryTotal: number;
  temperature: number;
  power: number;
  utilization: number;
};

export async function getGpuMetrics(): Promise<
  GPUMetric[]
> {
  const stdout =
    await sshService.exec(`
      nvidia-smi \
      --query-gpu=name,memory.used,memory.total,temperature.gpu,power.draw,utilization.gpu \
      --format=csv,noheader,nounits
    `);

  return stdout
    .trim()
    .split("\n")
    .map((line) => {
      const [
        name,
        memoryUsed,
        memoryTotal,
        temperature,
        power,
        utilization,
      ] = line.split(",");

      return {
        name: name.trim(),

        memoryUsed: Number(
          memoryUsed.trim()
        ),

        memoryTotal: Number(
          memoryTotal.trim()
        ),

        temperature: Number(
          temperature.trim()
        ),

        power: Number(
          power.trim()
        ),

        utilization: Number(
          utilization.trim()
        ),
      };
    });
}