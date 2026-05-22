import { NextResponse } from "next/server";

import { stopSSHSessionTerminal } from "../../../../../../../services/ssh/ssh-session-manager";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ sshId: string }> },
) {
  const { sshId } = await params;
  const stopped = stopSSHSessionTerminal(sshId);

  return NextResponse.json({
    success: true,
    data: {
      stopped,
    },
  });
}
