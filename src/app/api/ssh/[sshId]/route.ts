import { NextResponse } from "next/server";

import { prisma } from "../../../../../packages/db/src";

export const dynamic = "force-dynamic";

export async function DELETE(
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

    const remote = await prisma.sSHRemote.delete({
      where: {
        id: sshId,
      },
      select: {
        id: true,
        name: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: remote,
    });
  } catch (error) {
    console.error("Failed to delete SSH remote", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete SSH connection",
      },
      {
        status: 500,
      },
    );
  }
}
