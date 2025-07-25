import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { composioService } from "@/app/lib/services/composio";
import { checkRateLimit } from "@/app/lib/utils/rate-limiting";
import { validateUserFormOwnership } from "@/app/lib/auth/form-ownership";

// Schema for connection initiation request
const InitiateConnectionSchema = z.object({
  toolkit: z.enum([
    "GOOGLESHEETS",
    "SALESFORCE", 
    "HUBSPOT",
    "SLACKBOT",
    "NOTION",
    "AIRTABLE",
  ]),
  userId: z.string().uuid(),
  redirectUrl: z.string().url().optional(),
  scopes: z.array(z.string()).optional(),
});

// Schema for connection status request
const ConnectionStatusSchema = z.object({
  connectionId: z.string(),
  userId: z.string().uuid(),
});

// POST: Initiate a new integration connection
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { toolkit, userId, redirectUrl, scopes } = InitiateConnectionSchema.parse(body);

    // Rate limiting per user
    const rateLimitKey = `initiate_connection:${userId}`;
    const rateLimitAllowed = await checkRateLimit(rateLimitKey, 5, 300); // 5 connection attempts per 5 minutes
    
    if (!rateLimitAllowed) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          message: "Too many connection attempts. Please try again later.",
        },
        { status: 429 }
      );
    }

    // Initiate connection with Composio
    const connectionResult = await composioService.initiateConnection({
      userId,
      toolkit,
      redirectUrl: redirectUrl || `${process.env.NEXT_PUBLIC_APP_URL}/integrations/callback`,
      scopes,
    });

    // Log connection initiation
    console.log('Connection initiated:', {
      userId,
      toolkit,
      connectionId: connectionResult.connectionId,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      authUrl: connectionResult.authUrl,
      connectionId: connectionResult.connectionId,
      toolkit,
      message: `Please complete the ${toolkit} authorization`,
    });

  } catch (error) {
    console.error('Connection initiation failed:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Invalid request data",
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: "Connection failed",
        message: "Failed to initiate connection",
      },
      { status: 500 }
    );
  }
}

// GET: Check connection status
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const connectionId = url.searchParams.get('connectionId');
    const userId = url.searchParams.get('userId');

    if (!connectionId || !userId) {
      return NextResponse.json(
        {
          error: "Missing parameters",
          message: "connectionId and userId are required",
        },
        { status: 400 }
      );
    }

    const { connectionId: validConnectionId, userId: validUserId } = 
      ConnectionStatusSchema.parse({ connectionId, userId });

    // Get connection status from Composio
    const status = await composioService.getConnectionStatus(validConnectionId);

    return NextResponse.json({
      success: true,
      connectionId: validConnectionId,
      status: status.status,
      isActive: status.isActive,
      metadata: status.metadata,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Connection status check failed:', error);

    return NextResponse.json(
      {
        error: "Status check failed",
        message: "Failed to check connection status",
      },
      { status: 500 }
    );
  }
}

// DELETE: Revoke a connection
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { connectionId, userId } = ConnectionStatusSchema.parse(body);

    // Rate limiting for connection revocation
    const rateLimitKey = `revoke_connection:${userId}`;
    const rateLimitAllowed = await checkRateLimit(rateLimitKey, 10, 3600); // 10 revocations per hour
    
    if (!rateLimitAllowed) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          message: "Too many revocation attempts. Please try again later.",
        },
        { status: 429 }
      );
    }

    // Revoke the connection
    const success = await composioService.revokeConnection(connectionId);

    if (success) {
      // Also update the database to mark connection as revoked
      // This would typically update the user_integrations table
      console.log('Connection revoked:', {
        userId,
        connectionId,
        timestamp: new Date().toISOString(),
      });

      return NextResponse.json({
        success: true,
        message: "Connection successfully revoked",
        connectionId,
      });
    } else {
      return NextResponse.json(
        {
          error: "Revocation failed",
          message: "Failed to revoke connection",
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Connection revocation failed:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Invalid request data",
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: "Revocation failed",
        message: "Failed to revoke connection",
      },
      { status: 500 }
    );
  }
}