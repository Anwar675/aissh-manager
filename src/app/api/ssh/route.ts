import { NextResponse } from "next/server";
import { prisma } from "../../../../packages/db/src";

export async function GET() {
  try {
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

