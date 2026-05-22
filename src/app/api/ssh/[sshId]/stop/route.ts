import { NextResponse } from "next/server";

import { prisma } from "../../../../../../packages/db/src";
import {
  disconnectSSHSession,
  stopSSHSessionTerminal,
} from "../../../../../../services/ssh/ssh-session-manager";
import {
  createProvider,
  hasProviderApiKey,
} from "../../../../../../services/providers";
import { getProviderEnvKey } from "@/lib/vm-types";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ sshId: string }> },
) {
  const { sshId } = await params;

  try {
    const remote = await prisma.sSHRemote.findUnique({
      where: {
        id: sshId,
      },
    });

    if (!remote) {
      return NextResponse.json(
        {
          success: false,
          error: "SSH connection not found",
        },
        {
          status: 404,
        },
      );
    }

    const terminalStopped = stopSSHSessionTerminal(sshId);

    // Disconnect SSH session immediately
    disconnectSSHSession(sshId);

    // Stop provider instance if configured
    let providerStopped = false;
    let providerError: string | null = null;

    if (
      remote.provider &&
      remote.provider !== "local" &&
      remote.instanceId
    ) {
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
            remote.host, // Use host as region hint if needed
          );
          await provider.stopInstance();
          providerStopped = true;
        } catch (error) {
          console.warn("Failed to stop provider instance:", error);
          providerError = error instanceof Error ? error.message : String(error);
          // Continue anyway, still mark as inactive in DB
        }
      }
    }

    // Mark as inactive in database
    const updatedRemote = await prisma.sSHRemote.update({
      where: {
        id: sshId,
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

    return NextResponse.json({
      success: true,
      data: {
        ...updatedRemote,
        sshDisconnected: true,
        terminalStopped,
        providerStopped,
        providerError,
      },
    });
  } catch (error) {
    console.error("Failed to stop SSH remote", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to stop SSH connection",
      },
      {
        status: 500,
      },
    );
  }
}
