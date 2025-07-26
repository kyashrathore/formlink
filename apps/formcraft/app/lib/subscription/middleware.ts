import { NextResponse } from "next/server"
import { hasFeature, type PremiumFeature } from "./feature-gate"

export interface PremiumRequiredResponse {
  error: string
  upgradeUrl: string
  feature: string
}

export async function requirePremiumFeature(
  userId: string,
  feature: PremiumFeature
): Promise<boolean> {
  return await hasFeature(userId, feature)
}

export function createPremiumRequiredResponse(
  feature: PremiumFeature
): NextResponse {
  const response: PremiumRequiredResponse = {
    error: "Premium feature required",
    upgradeUrl: "/upgrade",
    feature,
  }

  return new NextResponse(JSON.stringify(response), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  })
}

export function withPremiumFeature(feature: PremiumFeature) {
  return function (
    handler: (request: Request, context: any) => Promise<Response>
  ) {
    return async function (request: Request, context: any) {
      const userId = context?.user?.id

      if (!userId) {
        return new NextResponse(
          JSON.stringify({ error: "Authentication required" }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" },
          }
        )
      }

      const hasAccess = await requirePremiumFeature(userId, feature)
      if (!hasAccess) {
        return createPremiumRequiredResponse(feature)
      }

      return handler(request, context)
    }
  }
}
