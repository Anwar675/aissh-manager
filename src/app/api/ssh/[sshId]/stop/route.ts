import { NextResponse } from "next/server";

import { stopSSHRemoteById } from "../../../../../../services/ssh/stop-remote";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ sshId: string }> },
) {
  const { sshId } = await params;

  try {
    const data = await stopSSHRemoteById(sshId);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Failed to stop SSH remote", error);

    if (error instanceof Error && error.message === "SSH connection not found") {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        {
          status: 404,
        },
      );
    }

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
