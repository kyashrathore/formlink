import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { composioService } from "@/app/lib/services/composio";

// Schema for OAuth callback parameters
const CallbackParamsSchema = z.object({
  code: z.string().min(1),
  state: z.string().optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
});

// GET: Handle OAuth callback from external services
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams.entries());

    // Check for OAuth error response
    if (params.error) {
      const errorDescription = params.error_description || 'OAuth authorization failed';
      
      console.error('OAuth callback error:', {
        error: params.error,
        description: errorDescription,
        timestamp: new Date().toISOString(),
      });

      // Redirect to frontend with error
      const errorUrl = new URL('/integrations/error', process.env.NEXT_PUBLIC_APP_URL!);
      errorUrl.searchParams.set('error', params.error);
      errorUrl.searchParams.set('message', errorDescription);
      
      return NextResponse.redirect(errorUrl);
    }

    // Validate callback parameters
    const { code, state } = CallbackParamsSchema.parse(params);

    // Extract user information from state parameter if available
    // In a real implementation, state would contain encrypted user/session info
    let userId: string | null = null;
    let connectionId: string | null = null;
    
    if (state) {
      try {
        // Decode state parameter (should contain user info)
        const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
        userId = stateData.userId;
        connectionId = stateData.connectionId;
      } catch (error) {
        console.error('Failed to decode state parameter:', error);
      }
    }

    if (!userId || !connectionId) {
      console.error('Missing user or connection information in callback');
      
      const errorUrl = new URL('/integrations/error', process.env.NEXT_PUBLIC_APP_URL!);
      errorUrl.searchParams.set('error', 'invalid_state');
      errorUrl.searchParams.set('message', 'Invalid callback state');
      
      return NextResponse.redirect(errorUrl);
    }

    // Complete the OAuth flow with Composio
    // Note: This is a simplified example. The actual implementation would depend on
    // Composio's specific callback handling mechanism
    try {
      const connectionStatus = await composioService.getConnectionStatus(connectionId);
      
      if (connectionStatus.isActive) {
        // Store the successful connection in the database
        await storeSuccessfulConnection({
          userId,
          connectionId,
          code, // OAuth authorization code
          timestamp: new Date(),
        });

        console.log('OAuth callback successful:', {
          userId,
          connectionId,
          timestamp: new Date().toISOString(),
        });

        // Redirect to success page
        const successUrl = new URL('/integrations/success', process.env.NEXT_PUBLIC_APP_URL!);
        successUrl.searchParams.set('connected', 'true');
        
        return NextResponse.redirect(successUrl);
      } else {
        throw new Error('Connection not active after OAuth completion');
      }
      
    } catch (error) {
      console.error('Failed to complete OAuth flow:', error);
      
      const errorUrl = new URL('/integrations/error', process.env.NEXT_PUBLIC_APP_URL!);
      errorUrl.searchParams.set('error', 'oauth_completion_failed');
      errorUrl.searchParams.set('message', 'Failed to complete authorization');
      
      return NextResponse.redirect(errorUrl);
    }

  } catch (error) {
    console.error('OAuth callback handler error:', error);

    if (error instanceof z.ZodError) {
      const errorUrl = new URL('/integrations/error', process.env.NEXT_PUBLIC_APP_URL!);
      errorUrl.searchParams.set('error', 'invalid_parameters');
      errorUrl.searchParams.set('message', 'Invalid callback parameters');
      
      return NextResponse.redirect(errorUrl);
    }

    const errorUrl = new URL('/integrations/error', process.env.NEXT_PUBLIC_APP_URL!);
    errorUrl.searchParams.set('error', 'callback_error');
    errorUrl.searchParams.set('message', 'OAuth callback processing failed');
    
    return NextResponse.redirect(errorUrl);
  }
}

// Helper function to store successful connection
async function storeSuccessfulConnection(data: {
  userId: string;
  connectionId: string;
  code: string;
  timestamp: Date;
}): Promise<void> {
  try {
    // This would typically:
    // 1. Update the user_integrations table with the successful connection
    // 2. Store granted scopes and connection metadata
    // 3. Mark the connection as active
    
    console.log('Storing successful connection:', {
      userId: data.userId,
      connectionId: data.connectionId,
      timestamp: data.timestamp.toISOString(),
    });

    // Mock implementation - in reality, this would be a database operation
    // Example database update:
    /*
    const supabase = createServerClient();
    await supabase
      .from('user_integrations')
      .update({
        connection_status: 'active',
        connected_at: data.timestamp,
        last_used_at: data.timestamp,
        updated_at: data.timestamp,
      })
      .eq('composio_connection_id', data.connectionId)
      .eq('user_id', data.userId);
    */

  } catch (error) {
    console.error('Failed to store successful connection:', error);
    throw error;
  }
}

// POST: Handle webhook callbacks from Composio (if supported)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Verify webhook signature if Composio provides one
    const signature = request.headers.get('x-composio-signature');
    if (signature) {
      // Implement signature verification here
      const isValidSignature = await verifyComposioWebhookSignature(body, signature);
      if (!isValidSignature) {
        return NextResponse.json(
          { error: "Invalid signature" },
          { status: 401 }
        );
      }
    }

    // Handle different webhook events
    const eventType = body.event_type;
    
    switch (eventType) {
      case 'connection.activated':
        await handleConnectionActivated(body);
        break;
      case 'connection.deactivated':
        await handleConnectionDeactivated(body);
        break;
      case 'connection.expired':
        await handleConnectionExpired(body);
        break;
      default:
        console.log('Unknown webhook event type:', eventType);
    }

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('Webhook callback error:', error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

// Helper functions for webhook event handling
async function verifyComposioWebhookSignature(body: any, signature: string): Promise<boolean> {
  // Implement webhook signature verification
  // This would typically use HMAC with a shared secret
  return true; // Simplified for now
}

async function handleConnectionActivated(data: any): Promise<void> {
  console.log('Connection activated webhook:', data);
  // Update database to mark connection as active
}

async function handleConnectionDeactivated(data: any): Promise<void> {
  console.log('Connection deactivated webhook:', data);
  // Update database to mark connection as inactive
}

async function handleConnectionExpired(data: any): Promise<void> {
  console.log('Connection expired webhook:', data);
  // Update database to mark connection as expired
}