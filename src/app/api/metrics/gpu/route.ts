import { NextResponse } from "next/server";
import { getGpuMetrics } from "../../../../../services/monitoring/gpu.service";


export const dynamic =
  "force-dynamic";

export async function GET() {
  try {
    const metrics =
      await getGpuMetrics();

    return NextResponse.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error",
      },
      {
        status: 503,
      }
    );
  }
}