import { prisma } from "../../packages/db/src";
import {
  createProvider,
  hasProviderApiKey,
} from "../providers";
import {
  disconnectSSHSession,
  stopSSHSessionTerminal,
} from "./ssh-session-manager";
import { getProviderEnvKey } from "../../src/lib/vm-types";

type StopRemote = {
  id: string;
  name: string;
  host: string;
  provider: string | null;
  instanceId: string | null;
  providerApiKey: string | null;
};

export type StopSSHRemoteResult = {
  id: string;
  name: string;
  sshDisconnected: boolean;
  terminalStopped: boolean;
  providerStopped: boolean;
  providerError: string | null;
};

async function stopRemote(remote: StopRemote): Promise<StopSSHRemoteResult> {
  const terminalStopped = stopSSHSessionTerminal(remote.id);

  disconnectSSHSession(remote.id);

  let providerStopped = false;
  let providerError: string | null = null;

  if (remote.provider && remote.provider !== "local" && remote.instanceId) {
    if (!hasProviderApiKey(remote.provider, remote.providerApiKey)) {
      const envKey = getProviderEnvKey(remote.provider);
      providerError = envKey
        ? `Missing provider API key. Set ${envKey} in .env.`
        : "Missing provider API key.";
    } else {
      try {
        const provider = createProvider(
          remote.provider,
          remote.instanceId,
          remote.providerApiKey ?? undefined,
          remote.host,
        );
        await provider.stopInstance();
        providerStopped = true;
      } catch (error) {
        console.warn("Failed to stop provider instance:", error);
        providerError = error instanceof Error ? error.message : String(error);
      }
    }
  }

  const updatedRemote = await prisma.sSHRemote.update({
    where: {
      id: remote.id,
    },
    data: {
      isActive: false,
      usageEndedAt: new Date(),
    },
    select: {
      id: true,
      name: true,
    },
  });

  return {
    ...updatedRemote,
    sshDisconnected: true,
    terminalStopped,
    providerStopped,
    providerError,
  };
}

export async function stopSSHRemoteById(id: string) {
  const remote = await prisma.sSHRemote.findUnique({
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

  if (!remote) {
    throw new Error("SSH connection not found");
  }

  return stopRemote(remote);
}

export async function stopActiveSSHRemotes() {
  const remotes = await prisma.sSHRemote.findMany({
    where: {
      isActive: true,
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

  const results: StopSSHRemoteResult[] = [];
  const errors: string[] = [];

  for (const remote of remotes) {
    try {
      results.push(await stopRemote(remote));
    } catch (error) {
      errors.push(
        `${remote.name}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return {
    results,
    errors,
  };
}
