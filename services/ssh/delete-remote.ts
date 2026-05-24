import { prisma } from "../../packages/db/src";
import {
  createProvider,
  hasProviderApiKey,
} from "../providers";
import { getProviderEnvKey } from "../../src/lib/vm-types";
import { disconnectSSHSession } from "./ssh-session-manager";

type DeleteableRemote = {
  id: string;
  name: string;
  host: string;
  provider: string | null;
  instanceId: string | null;
  providerApiKey: string | null;
};

type DeleteFailure = {
  id: string;
  name: string;
  error: string;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function requiresProviderDestroy(remote: DeleteableRemote) {
  return remote.provider === "vast-ai" && Boolean(remote.instanceId);
}

async function destroyProviderInstance(remote: DeleteableRemote) {
  if (!requiresProviderDestroy(remote)) {
    return null;
  }

  if (!remote.provider || !remote.instanceId) {
    return null;
  }

  if (!hasProviderApiKey(remote.provider, remote.providerApiKey)) {
    const envKey = getProviderEnvKey(remote.provider);
    throw new Error(
      envKey
        ? `Missing provider API key. Set ${envKey} in .env.`
        : "Missing provider API key.",
    );
  }

  const provider = createProvider(
    remote.provider,
    remote.instanceId,
    remote.providerApiKey ?? undefined,
    remote.host,
  );

  return provider.destroyInstance();
}

export async function deleteSSHRemoteById(id: string) {
  const existing = await prisma.sSHRemote.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      name: true,
      host: true,
      provider: true,
      instanceId: true,
      providerApiKey: true,
    },
  });

  if (!existing) {
    throw new Error("SSH connection not found");
  }

  const providerDestroy = await destroyProviderInstance(existing);
  disconnectSSHSession(existing.id);

  const remote = await prisma.sSHRemote.delete({
    where: {
      id,
    },
    select: {
      id: true,
      name: true,
    },
  });

  return {
    ...remote,
    providerDestroyed: Boolean(providerDestroy),
    providerMessage: providerDestroy?.message ?? null,
  };
}

export async function deleteSSHRemotesByIds(ids: string[]) {
  const existingRemotes = await prisma.sSHRemote.findMany({
    where: {
      id: {
        in: ids,
      },
    },
    select: {
      id: true,
      name: true,
      host: true,
      provider: true,
      instanceId: true,
      providerApiKey: true,
    },
  });

  if (existingRemotes.length === 0) {
    throw new Error("SSH connections not found");
  }

  const destroyableIds: string[] = [];
  const failures: DeleteFailure[] = [];

  for (const remote of existingRemotes) {
    try {
      await destroyProviderInstance(remote);
      destroyableIds.push(remote.id);
    } catch (error) {
      failures.push({
        id: remote.id,
        name: remote.name,
        error: getErrorMessage(error),
      });
    }
  }

  if (destroyableIds.length === 0) {
    const firstFailure = failures[0];
    throw new Error(firstFailure?.error ?? "Failed to delete SSH connections");
  }

  const deleted = await prisma.sSHRemote.deleteMany({
    where: {
      id: {
        in: destroyableIds,
      },
    },
  });

  for (const id of destroyableIds) {
    disconnectSSHSession(id);
  }

  return {
    ids: destroyableIds,
    count: deleted.count,
    failures,
  };
}
