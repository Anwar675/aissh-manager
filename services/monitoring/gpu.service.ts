import { SSHService } from "../ssh/ssh.service";

export type GPUMetric = {
  name: string;
  memoryUsed: number;
  memoryTotal: number;
  temperature: number;
  power: number;
  utilization: number;
};

const GPU_METRICS_COMMAND = `
      nvidia-smi \
      --query-gpu=name,memory.used,memory.total,temperature.gpu,power.draw,utilization.gpu \
      --format=csv,noheader,nounits
    `;

function parseGpuMetrics(stdout: string): GPUMetric[] {
  return stdout
    .trim()
    .split("\n")
    .filter(Boolean)
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

export async function getGpuMetricsFromSSH(
  ssh: Pick<SSHService, "exec">,
): Promise<GPUMetric[]> {
  const stdout = await ssh.exec(GPU_METRICS_COMMAND);

  return parseGpuMetrics(stdout);
}

export async function getGpuMetrics(remote: {
  host: string;
  port: number;
  username: string;

  sshKeyName?: string;
  passphrase?: string;
  password?: string;
}): Promise<GPUMetric[]> {
  const ssh = new SSHService(remote);

  try {
    return await getGpuMetricsFromSSH(ssh);
  } finally {
    ssh.disconnect();
  }
}
