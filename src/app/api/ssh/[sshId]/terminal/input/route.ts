import { NextResponse } from "next/server";

import { writeSSHSessionTerminal } from "../../../../../../../services/ssh/ssh-session-manager";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ sshId: string }> },
) {
  const { sshId } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    input?: unknown;
  };
  const input = typeof body.input === "string" ? body.input : "";

  if (!input) {
    return NextResponse.json(
      {
        success: false,
        error: "Missing terminal input",
      },
      {
        status: 400,
      },
    );
  }

  const written = writeSSHSessionTerminal(sshId, input.slice(0, 8000));

  if (!written) {
    return NextResponse.json(
      {
        success: false,
        error: "Terminal is not running",
      },
      {
        status: 409,
      },
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      written,
    },
  });
}
