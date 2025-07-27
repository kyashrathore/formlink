import { authErrorResponse, requireAuth } from "@/app/lib/middleware/auth"
import { put } from "@vercel/blob"
import { NextResponse } from "next/server"

const MAX_FILE_SIZE = 5 * 1024 * 1024
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"]

export async function POST(request: Request): Promise<NextResponse> {
  let authResult
  try {
    authResult = await requireAuth(request)
  } catch (error) {
    return authErrorResponse({
      name: "AuthError",
      message: error instanceof Error ? error.message : "Authentication failed",
      statusCode: 401,
    })
  }

  const { searchParams } = new URL(request.url)
  const filename = searchParams.get("filename")
  const contentType = request.headers.get("content-type")

  if (!filename || !request.body) {
    return NextResponse.json(
      { message: "Missing filename or request body" },
      { status: 400 }
    )
  }

  if (!contentType || !ALLOWED_TYPES.includes(contentType)) {
    return NextResponse.json(
      {
        message:
          "Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.",
      },
      { status: 400 }
    )
  }

  const contentLength = request.headers.get("content-length")
  if (contentLength && parseInt(contentLength) > MAX_FILE_SIZE) {
    return NextResponse.json(
      { message: "File too large. Maximum size is 5MB." },
      { status: 400 }
    )
  }

  const userFilename = `${authResult.user.id}/${Date.now()}-${filename}`

  const blob = await put(userFilename, request.body, {
    access: "public",
    contentType,
  })

  return NextResponse.json(blob)
}
