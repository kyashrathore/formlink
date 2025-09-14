import { authErrorResponse, requireAuth } from "@/app/lib/middleware/auth"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req)
    return NextResponse.json({
      total_requests: 0,
      requests_by_endpoint: {},
      requests_by_day: [],
      error_rate: 0,
      top_origins: [],
    })
  } catch (error) {
    return authErrorResponse({
      name: "Error",
      message: (error as Error).message,
      statusCode: 500,
    })
  }
}
