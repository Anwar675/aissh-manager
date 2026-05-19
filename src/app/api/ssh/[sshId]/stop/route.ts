import { NextResponse } from "next/server";

import { prisma } from "../../../../../../packages/db/src";
import { disconnectSSHSession } from "../../../../../../services/ssh/ssh-session-manager";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ sshId: string }> },
) {
  const { sshId } = await params;

  try {
    const existing = await prisma.sSHRemote.findUnique({
      where: {
        id: sshId,
      },
      select: {
        id: true,
      },
    });

    if (!existing) {
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

    const disconnected = disconnectSSHSession(sshId);

    const remote = await prisma.sSHRemote.update({
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
        ...remote,
        disconnected,
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
