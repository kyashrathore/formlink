import { put } from "@vercel/blob"
import { NextResponse } from "next/server"

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"]

export async function POST(request: Request): Promise<NextResponse> {
  // Require authentication
  const { requireAuth, authErrorResponse } = await import(
    "../../lib/middleware/auth"
  )
  let authResult
  try {
    authResult = await requireAuth(request)
  } catch (error: any) {
    return authErrorResponse(error)
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

  // Validate content type
  if (!contentType || !ALLOWED_TYPES.includes(contentType)) {
    return NextResponse.json(
      {
        message:
          "Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.",
      },
      { status: 400 }
    )
  }

  // Check content length
  const contentLength = request.headers.get("content-length")
  if (contentLength && parseInt(contentLength) > MAX_FILE_SIZE) {
    return NextResponse.json(
      { message: "File too large. Maximum size is 5MB." },
      { status: 400 }
    )
  }

  // Add user ID to filename to prevent conflicts
  const userFilename = `${authResult.user.id}/${Date.now()}-${filename}`

  const blob = await put(userFilename, request.body, {
    access: "public",
    contentType,
  })

  return NextResponse.json(blob)
}
