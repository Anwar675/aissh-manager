import { SSHService } from "../ssh/ssh.service";

export type GPUMetric = {
  name: string;
  memoryUsed: number;
  memoryTotal: number;
  temperature: number;
  power: number;
  utilization: number;
};

export async function getGpuMetrics(remote: {
  host: string;
  port: number;
  username: string;

  sshKeyName?: string;
  passphrase?: string;
  password?: string;
}): Promise<GPUMetric[]> {
  const ssh = new SSHService(remote);

  const stdout = await ssh.exec(`
      nvidia-smi \
      --query-gpu=name,memory.used,memory.total,temperature.gpu,power.draw,utilization.gpu \
      --format=csv,noheader,nounits
    `);

  return stdout
    .trim()
    .split("\n")
    .map((line) => {
      const [name, memoryUsed, memoryTotal, temperature, power, utilization] =
        line.split(",");

      return {
        name: name.trim(),

        memoryUsed: Number(memoryUsed.trim()),

        memoryTotal: Number(memoryTotal.trim()),

        temperature: Number(temperature.trim()),

        power: Number(power.trim()),

        utilization: Number(utilization.trim()),
      };
    });
}
