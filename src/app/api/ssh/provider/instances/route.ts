import { NextResponse } from "next/server";

import { getProviderApiKey } from "../../../../../../services/providers";
import {
  getProviderEnvKey,
  isProviderKey,
  type ProviderInstance,
} from "@/lib/vm-types";

export const dynamic = "force-dynamic";

function toNumber(value: unknown) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function pickString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function pickSshPort(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const mappings = value as Record<string, unknown>;
  const port = toNumber(mappings["22"]);

  return port && port > 0 ? port : null;
}

function parseDirectSsh(value: unknown) {
  if (typeof value !== "string") {
    return {
      host: null,
      port: null,
      username: null,
    };
  }

  const port = value.match(/\s-p\s+(\d+)/)?.[1];
  const target = value.match(/(?:^|\s)([a-zA-Z0-9._-]+)@([a-zA-Z0-9._-]+)/);

  return {
    host: target?.[2] ?? null,
    port: port ? toNumber(port) : null,
    username: target?.[1] ?? null,
  };
}

function asRecord(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

async function parseJsonResponse(response: Response) {
  const text = await response.text();

  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

async function listRunPodInstances(apiKey: string): Promise<ProviderInstance[]> {
  const response = await fetch("https://rest.runpod.io/v1/pods?includeMachine=true", {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`RunPod API failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const pods = Array.isArray(data) ? data : data.pods;

  return (Array.isArray(pods) ? pods : []).map((pod) => ({
    id: String(pod.id),
    name: pickString(pod.name, pod.id) ?? String(pod.id),
    status: pickString(pod.desiredStatus),
    machineType: pickString(
      pod.gpu?.displayName,
      pod.machine?.gpuDisplayName,
      pod.gpuTypeId,
      pod.cpuFlavorId,
    ),
    host: pickString(pod.publicIp),
    port: pickSshPort(pod.portMappings),
    username: "root",
    pricePerHour: toNumber(pod.adjustedCostPerHr ?? pod.costPerHr),
    region: pickString(pod.dataCenterId, pod.machine?.dataCenterId),
  }));
}

async function listLambdaInstances(apiKey: string): Promise<ProviderInstance[]> {
  const response = await fetch("https://cloud.lambdalabs.com/api/v1/instances", {
    headers: {
      Authorization: `Basic ${Buffer.from(`:${apiKey}`).toString("base64")}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Lambda Labs API failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const instances: unknown[] = Array.isArray(data.data) ? data.data : [];

  return instances.map((item) => {
    const instance = asRecord(item);
    const instanceType = asRecord(instance.instance_type);
    const region = asRecord(instance.region);
    const priceCentsPerHour = toNumber(instanceType.price_cents_per_hour);

    return {
      id: String(instance.id),
      name: pickString(instance.name, instance.id) ?? String(instance.id),
      status: pickString(instance.status),
      machineType: pickString(instanceType.name, instanceType.description),
      host: pickString(instance.ip),
      port: 22,
      username: "ubuntu",
      pricePerHour:
        priceCentsPerHour === null ? null : priceCentsPerHour / 100,
      region: pickString(region.name, region.description),
    };
  });
}

async function listVastInstances(apiKey: string): Promise<ProviderInstance[]> {
  const response = await fetch("https://cloud.vast.ai/api/v1/instances/", {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const error = await parseJsonResponse(response);
    throw new Error(
      `Vast AI API failed: ${response.status} ${response.statusText}${
        typeof error === "string" ? ` ${error}` : ""
      }`,
    );
  }

  const data = await response.json();
  const instances: unknown[] = Array.isArray(data.instances)
    ? data.instances
    : Array.isArray(data)
      ? data
      : [];

  return instances.map((item) => {
    const instance = asRecord(item);
    const id = String(instance.id ?? instance.instance_id ?? instance.contract_id);
    const directSsh = parseDirectSsh(
      instance.direct_ssh ?? instance.ssh_command ?? instance.ssh_url,
    );

    return {
      id,
      name: pickString(instance.label, instance.name, id) ?? id,
      status: pickString(instance.status, instance.cur_state, instance.actual_status),
      machineType: pickString(instance.gpu_name, instance.gpu_display_name, instance.machine_id),
      host: pickString(instance.ssh_host, directSsh.host, instance.host),
      port: toNumber(instance.ssh_port) ?? directSsh.port,
      username:
        pickString(instance.ssh_user, directSsh.username, instance.username) ??
        "root",
      pricePerHour: toNumber(instance.dph_total ?? instance.price_hr ?? instance.cost_per_hour),
      region: pickString(instance.geolocation, instance.location),
    };
  });
}

async function listAzureInstances(apiKey: string): Promise<ProviderInstance[]> {
  const [subscriptionId, accessToken] = apiKey.includes(":")
    ? apiKey.split(/:(.+)/)
    : [process.env.AZURE_SUBSCRIPTION_ID ?? "", apiKey];
  const resourceGroup = process.env.AZURE_RESOURCE_GROUP;

  if (!subscriptionId || !accessToken) {
    throw new Error("Set AZURE_SUBSCRIPTION_ID and AZURE_ACCESS_TOKEN in .env.");
  }

  if (!resourceGroup) {
    throw new Error("Set AZURE_RESOURCE_GROUP in .env to list Azure VMs.");
  }

  const response = await fetch(
    `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.Compute/virtualMachines?api-version=2024-03-01`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(`Azure API failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const instances: unknown[] = Array.isArray(data.value) ? data.value : [];

  return instances.map((item) => {
    const instance = asRecord(item);
    const properties = asRecord(instance.properties);
    const hardwareProfile = asRecord(properties.hardwareProfile);

    return {
      id: `${resourceGroup}:${instance.name}`,
      name: pickString(instance.name) ?? String(instance.id),
      status: pickString(properties.provisioningState),
      machineType: pickString(hardwareProfile.vmSize),
      host: null,
      port: 22,
      username: null,
      pricePerHour: null,
      region: pickString(instance.location),
    };
  });
}

async function listProviderInstances(provider: string, apiKey: string) {
  switch (provider) {
    case "runpod":
      return listRunPodInstances(apiKey);
    case "lambda-labs":
      return listLambdaInstances(apiKey);
    case "vast-ai":
      return listVastInstances(apiKey);
    case "azure":
      return listAzureInstances(apiKey);
    case "tensordock":
      return [] satisfies ProviderInstance[];
    default:
      return [] satisfies ProviderInstance[];
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const provider = searchParams.get("provider") ?? "";

  if (!isProviderKey(provider)) {
    return NextResponse.json(
      {
        success: false,
        error: "Unsupported provider",
      },
      {
        status: 400,
      },
    );
  }

  if (provider === "local") {
    return NextResponse.json({
      success: true,
      data: [],
    });
  }

  const apiKey = getProviderApiKey(provider);
  const envKey = getProviderEnvKey(provider);

  if (!apiKey) {
    return NextResponse.json(
      {
        success: false,
        error: envKey
          ? `Missing provider API key. Set ${envKey} in .env.`
          : "Missing provider API key.",
      },
      {
        status: 400,
      },
    );
  }

  try {
    const instances = await listProviderInstances(provider, apiKey);

    return NextResponse.json({
      success: true,
      data: instances,
    });
  } catch (error) {
    console.error("Failed to list provider instances", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to list provider instances",
      },
      {
        status: 502,
      },
    );
  }
}
