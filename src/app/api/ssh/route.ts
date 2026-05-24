import { NextResponse } from "next/server";
import { prisma } from "../../../../packages/db/src";
import { getSSHSessionTerminalState } from "../../../../services/ssh/ssh-session-manager";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const status = new URL(req.url).searchParams.get("status");

    if (status === "active") {
      const remotes = await prisma.sSHRemote.findMany({
        where: {
          isActive: true,
        },
        orderBy: {
          connectedAt: "desc",
        },
        select: {
          id: true,
          name: true,
          description: true,
          host: true,
          port: true,
          username: true,
          authType: true,
          provider: true,
          instanceId: true,
          machineType: true,
          isActive: true,
          pricePerHour: true,
          currency: true,
          usageStartedAt: true,
          usageEndedAt: true,
          connectedAt: true,
          createdAt: true,
        },
      });

      return NextResponse.json({
        success: true,
        data: remotes.map((remote) => {
          const terminalState = getSSHSessionTerminalState(remote.id);

          return {
            ...remote,
            description: remote.description ?? "",
            provider: remote.provider ?? "local",
            instanceId: remote.instanceId,
            machineType: remote.machineType ?? "",
            terminalRunning: terminalState.running,
            terminalProgressPercent: terminalState.progressPercent,
            status: "Active",
            usageStartedAt: remote.usageStartedAt?.toISOString() ?? null,
            usageEndedAt: remote.usageEndedAt?.toISOString() ?? null,
            connectedAt: remote.connectedAt?.toISOString() ?? null,
            createdAt: remote.createdAt.toISOString(),
          };
        }),
      });
    }

    const [total, active] = await Promise.all([
      prisma.sSHRemote.count(),
      prisma.sSHRemote.count({
        where: {
          isActive: true,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        total,
        active,
        idle: Math.max(total - active, 0),
      },
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to load SSH summary",
      },
      {
        status: 500,
      },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const pricePerHour =
      body.pricePerHour === null ||
      body.pricePerHour === undefined ||
      body.pricePerHour === ""
        ? null
        : Number(body.pricePerHour);

    if (
      pricePerHour !== null &&
      (!Number.isFinite(pricePerHour) || pricePerHour < 0)
    ) {
      return NextResponse.json(
        {
          error: "Invalid price per hour",
        },
        {
          status: 400,
        },
      );
    }

    const provider =
      typeof body.provider === "string" ? body.provider.trim() : "local";
    const machineType =
      typeof body.machineType === "string" && body.machineType.trim()
        ? body.machineType.trim()
        : null;
    const instanceId =
      provider !== "local" && typeof body.instanceId === "string"
        ? body.instanceId.trim()
        : null;

    if (provider !== "local" && !instanceId) {
      return NextResponse.json(
        {
          error: "Provider instance ID is required",
        },
        {
          status: 400,
        },
      );
    }

    const connection = await prisma.sSHRemote.create({
      data: {
        name: body.name,
        description: body.description,
        host: body.host,
        port: body.port,
        username: body.username,
        password: body.password,
        passphrase: body.passphrase,
        privateKey: body.sshKeyName,
        authType: body.password ? "PASSWORD" : "PRIVATE_KEY",
        provider: provider || null,
        machineType,
        instanceId: instanceId || null,
        pricePerHour,
      },
    });

    return NextResponse.json(connection);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error: "Failed to create SSH connection",
      },
      {
        status: 500,
      },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const ids = Array.from(
      new Set<string>(
        Array.isArray(body?.ids)
          ? body.ids
              .filter((id: unknown): id is string => typeof id === "string")
              .map((id: string) => id.trim())
              .filter(Boolean)
          : [],
      ),
    );

    if (ids.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No SSH connections selected",
        },
        {
          status: 400,
        },
      );
    }

    const existingRemotes = await prisma.sSHRemote.findMany({
      where: {
        id: {
          in: ids,
        }
      },
      select: {
        id: true,
      },
    });
    const existingIds = existingRemotes.map((remote) => remote.id);

    if (existingIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "SSH connections not found",
        },
        {
          status: 404,
        },
      );
    }

    const deleted = await prisma.sSHRemote.deleteMany({
      where: {
        id: {
          in: existingIds,
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ids: existingIds,
        count: deleted.count,
      },
    });
  } catch (error) {
    console.error("Failed to delete SSH remotes", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete SSH connections",
      },
      {
        status: 500,
      },
    );
  }
}
