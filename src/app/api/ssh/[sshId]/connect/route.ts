import { NextResponse } from "next/server";

import { prisma } from "../../../../../../packages/db/src";
import {
  connectSSHSession,
  disconnectSSHSession,
} from "../../../../../../services/ssh/ssh-session-manager";

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

    await connectSSHSession(remote.id, {
      host: remote.host,
      port: remote.port,
      username: remote.username,
      password: remote.password ?? undefined,
      sshKeyName: remote.privateKey ?? undefined,
      passphrase: remote.passphrase ?? undefined,
    });

    try {
      const connectedAt = new Date();

      await prisma.sSHRemote.update({
        where: {
          id: sshId,
        },
        data: {
          isActive: true,
          connectedAt,
          usageStartedAt: connectedAt,
          usageEndedAt: null,
        },
      });
    } catch (error) {
      disconnectSSHSession(remote.id);

      throw error;
    }

    return NextResponse.json({
      success: true,
      data: {
        id: remote.id,
        name: remote.name,
      },
    });
  } catch (error) {
    console.error("Failed to connect SSH remote", error);

    return NextResponse.json(
      {
        success: false,
        error: "Not available",
      },
      {
        status: 503,
      },
    );
  }
}
