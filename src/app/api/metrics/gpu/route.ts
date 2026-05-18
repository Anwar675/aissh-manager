import { NextResponse } from "next/server";
import { getGpuMetrics } from "../../../../../services/monitoring/gpu.service";
import { prisma } from "../../../../../packages/db/src";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const remote = await prisma.sSHRemote.findFirst({
      where: {
        isActive: true,
      },
    });

    if (!remote) {
      return NextResponse.json(
        {
          success: false,
          error: "Hiện không có máy nào active",
        },
        {
          status: 400,
        },
      );
    }

    const metrics = await getGpuMetrics({
      host: remote.host,
      port: remote.port,
      username: remote.username,
      password: remote.password ?? undefined,
      sshKeyName: remote.privateKey ?? undefined,
      passphrase: remote.passphrase ?? undefined,
    });

    return NextResponse.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      {
        status: 503,
      },
    );
  }
}
