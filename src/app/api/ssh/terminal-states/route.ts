import { NextResponse } from "next/server";

import { prisma } from "../../../../../packages/db/src";
import { getSSHSessionTerminalState } from "../../../../../services/ssh/ssh-session-manager";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const remotes = await prisma.sSHRemote.findMany({
      select: {
        id: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: remotes.map((remote) => {
        const terminalState = getSSHSessionTerminalState(remote.id);

        return {
          id: remote.id,
          terminalRunning: terminalState.running,
          terminalProgressPercent: terminalState.progressPercent,
        };
      }),
    });
  } catch (error) {
    console.error("Failed to load SSH terminal states", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to load terminal states",
      },
      {
        status: 500,
      },
    );
  }
}
