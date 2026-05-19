import { NextResponse } from "next/server";
import {
  getGpuMetrics,
  getGpuMetricsFromSSH,
} from "../../../../../services/monitoring/gpu.service";
import { prisma } from "../../../../../packages/db/src";
import { getSSHSession } from "../../../../../services/ssh/ssh-session-manager";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const sshId = new URL(req.url).searchParams.get("sshId");
    const remote = sshId
      ? await prisma.sSHRemote.findUnique({
          where: {
            id: sshId,
          },
        })
      : await prisma.sSHRemote.findFirst({
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

    if (!remote.isActive) {
      return NextResponse.json(
        {
          success: false,
          error: "Máy này chưa active",
        },
        {
          status: 400,
        },
      );
    }

    const ssh = getSSHSession(remote.id);
    const metrics = ssh
      ? await getGpuMetricsFromSSH(ssh)
      : await getGpuMetrics({
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
