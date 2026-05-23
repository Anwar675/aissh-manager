import { NextResponse } from "next/server";

import { runDueAutoStops } from "../../../../../../services/ssh/auto-stop-scheduler";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const data = await runDueAutoStops();

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Failed to run due auto stop schedules", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to run due auto stop schedules",
      },
      {
        status: 500,
      },
    );
  }
}
