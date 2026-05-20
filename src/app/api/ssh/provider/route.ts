import { NextResponse } from "next/server";

import { prisma } from "../../../../../packages/db/src";
import {
  getProviderEnvKey,
  isProviderKey,
  PROVIDER_ENV_KEYS,
} from "@/lib/vm-types";

export const dynamic = "force-dynamic";

export async function GET() {
  const providers = Object.entries(PROVIDER_ENV_KEYS)
    .filter(([, envKey]) => Boolean(envKey))
    .map(([provider, envKey]) => ({
      provider,
      envKey,
      configured: Boolean(envKey && process.env[envKey]),
    }));

  return NextResponse.json({
    success: true,
    data: providers,
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { sshId, provider, instanceId } = body;

    if (!sshId || !provider) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: sshId, provider",
        },
        {
          status: 400,
        },
      );
    }

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

    const remote = await prisma.sSHRemote.findUnique({
      where: {
        id: sshId,
      },
      select: {
        id: true,
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

    const updated = await prisma.sSHRemote.update({
      where: {
        id: sshId,
      },
      data: {
        provider,
        instanceId: instanceId || null,
        providerApiKey: null,
      },
      select: {
        id: true,
        name: true,
        provider: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...updated,
        providerEnvKey: getProviderEnvKey(provider),
      },
    });
  } catch (error) {
    console.error("Failed to update provider credentials", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to update provider credentials",
      },
      {
        status: 500,
      },
    );
  }
}
