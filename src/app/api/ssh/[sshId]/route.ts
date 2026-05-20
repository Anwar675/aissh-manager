import { NextResponse } from "next/server";

import { prisma } from "../../../../../packages/db/src";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sshId: string }> },
) {
  const { sshId } = await params;

  try {
    const remote = await prisma.sSHRemote.findUnique({
      where: {
        id: sshId,
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

    return NextResponse.json({
      success: true,
      data: {
        ...remote,
        description: remote.description ?? "",
        provider: remote.provider ?? "local",
        instanceId: remote.instanceId,
        machineType: remote.machineType ?? "",
        status: remote.isActive ? "Active" : "Saved",
        usageStartedAt: remote.usageStartedAt?.toISOString() ?? null,
        usageEndedAt: remote.usageEndedAt?.toISOString() ?? null,
        connectedAt: remote.connectedAt?.toISOString() ?? null,
        createdAt: remote.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Failed to load SSH remote", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to load SSH connection",
      },
      {
        status: 500,
      },
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ sshId: string }> },
) {
  const { sshId } = await params;

  try {
    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const description =
      typeof body.description === "string" ? body.description.trim() : "";
    const host = typeof body.host === "string" ? body.host.trim() : "";
    const username =
      typeof body.username === "string" ? body.username.trim() : "";
    const provider =
      typeof body.provider === "string" ? body.provider.trim() : "";
    const instanceId =
      typeof body.instanceId === "string" && body.instanceId.trim()
        ? body.instanceId.trim()
        : null;
    const machineType =
      typeof body.machineType === "string" && body.machineType.trim()
        ? body.machineType.trim()
        : null;
    const port = Number(body.port);
    const password =
      typeof body.password === "string" ? body.password.trim() : "";
    const sshKeyName =
      typeof body.sshKeyName === "string" ? body.sshKeyName.trim() : "";
    const passphrase =
      typeof body.passphrase === "string" ? body.passphrase.trim() : "";
    const pricePerHour =
      body.pricePerHour === null ||
      body.pricePerHour === undefined ||
      body.pricePerHour === ""
        ? null
        : Number(body.pricePerHour);

    if (
      !name ||
      !host ||
      !username ||
      !Number.isInteger(port) ||
      port <= 0 ||
      (pricePerHour !== null &&
        (!Number.isFinite(pricePerHour) || pricePerHour < 0))
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid SSH connection details",
        },
        {
          status: 400,
        },
      );
    }

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

    const remote = await prisma.sSHRemote.update({
      where: {
        id: sshId,
      },
      data: {
        name,
        description: description || null,
        host,
        port,
        username,
        ...(sshKeyName
          ? {
              password: null,
              privateKey: sshKeyName,
              authType: "PRIVATE_KEY" as const,
            }
          : {}),
        ...(password
          ? {
              password,
              privateKey: null,
              authType: "PASSWORD" as const,
            }
          : {}),
        ...(passphrase
          ? {
              passphrase,
            }
          : {}),
        provider: provider || null,
        instanceId,
        machineType,
        pricePerHour,
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
      data: {
        ...remote,
        description: remote.description ?? "",
        provider: remote.provider ?? "local",
        instanceId: remote.instanceId,
        machineType: remote.machineType ?? "",
        status: remote.isActive ? "Active" : "Saved",
        usageStartedAt: remote.usageStartedAt?.toISOString() ?? null,
        usageEndedAt: remote.usageEndedAt?.toISOString() ?? null,
        connectedAt: remote.connectedAt?.toISOString() ?? null,
        createdAt: remote.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Failed to update SSH remote", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to update SSH connection",
      },
      {
        status: 500,
      },
    );
  }
}

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
