import { NextResponse } from "next/server";

import {
  cancelAutoStops,
  createAutoStops,
  listPendingAutoStops,
  type AutoStopTargetType,
} from "../../../../../services/ssh/auto-stop-scheduler";
import { prisma } from "../../../../../packages/db/src";

export const dynamic = "force-dynamic";

function parseScheduledAt(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const scheduledAt = new Date(value);

  if (!Number.isFinite(scheduledAt.getTime())) {
    return null;
  }

  return scheduledAt;
}

function normalizeIds(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((id): id is string => typeof id === "string")
    .map((id) => id.trim())
    .filter(Boolean);
}

export async function GET() {
  try {
    const data = await listPendingAutoStops();

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Failed to load auto stop schedules", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to load auto stop schedules",
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
    const scope = body.scope === "all" ? "all" : "selected";
    const scheduledAt = parseScheduledAt(body.scheduledAt);

    if (!scheduledAt) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid auto stop time",
        },
        {
          status: 400,
        },
      );
    }

    if (scheduledAt.getTime() <= Date.now()) {
      return NextResponse.json(
        {
          success: false,
          error: "Auto stop time must be in the future",
        },
        {
          status: 400,
        },
      );
    }

    const targetType: AutoStopTargetType =
      scope === "all" ? "ALL_ACTIVE" : "SSH_REMOTE";
    let sshRemoteIds = normalizeIds(body.ids);

    if (targetType === "SSH_REMOTE") {
      if (sshRemoteIds.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: "Select at least one machine",
          },
          {
            status: 400,
          },
        );
      }

      const existing = await prisma.sSHRemote.findMany({
        where: {
          id: {
            in: sshRemoteIds,
          },
        },
        select: {
          id: true,
        },
      });
      const existingIds = new Set(existing.map((item) => item.id));

      sshRemoteIds = sshRemoteIds.filter((id) => existingIds.has(id));

      if (sshRemoteIds.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: "Selected machines were not found",
          },
          {
            status: 404,
          },
        );
      }
    }

    const data = await createAutoStops({
      targetType,
      sshRemoteIds,
      scheduledAt,
    });

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Failed to create auto stop schedule", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to create auto stop schedule",
      },
      {
        status: 500,
      },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const ids = normalizeIds(body.ids);

    if (ids.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No auto stop schedules selected",
        },
        {
          status: 400,
        },
      );
    }

    await cancelAutoStops(ids);

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Failed to cancel auto stop schedules", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to cancel auto stop schedules",
      },
      {
        status: 500,
      },
    );
  }
}
