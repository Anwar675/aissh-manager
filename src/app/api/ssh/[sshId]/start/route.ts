import { NextResponse } from "next/server";

import { prisma } from "../../../../../../packages/db/src";
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

    let providerStarted = false;
    let providerError: string | null = null;

    if (remote.provider && remote.provider !== "local") {
      if (!remote.instanceId) {
        providerError = "Missing provider instance ID.";
      } else if (!hasProviderApiKey(remote.provider, remote.providerApiKey)) {
        const envKey = getProviderEnvKey(remote.provider);
        providerError = envKey
          ? `Missing provider API key. Set ${envKey} in .env.`
          : "Missing provider API key.";
      } else {
        const provider = createProvider(
          remote.provider,
          remote.instanceId,
          remote.providerApiKey ?? undefined,
          remote.host,
        );

        await provider.startInstance();
        providerStarted = true;
      }
    }

    if (providerError) {
      return NextResponse.json(
        {
          success: false,
          error: providerError,
        },
        {
          status: 400,
        },
      );
    }

    const startedAt = new Date();
    const updatedRemote = await prisma.sSHRemote.update({
      where: {
        id: sshId,
      },
      data: {
        isActive: true,
        usageStartedAt: startedAt,
        usageEndedAt: null,
      },
      select: {
        id: true,
        name: true,
        usageStartedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...updatedRemote,
        providerStarted,
        usageStartedAt: updatedRemote.usageStartedAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    console.error("Failed to start SSH remote", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to start SSH connection",
      },
      {
        status: 500,
      },
    );
  }
}
