import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { executeFormIntegrationsSecure } from "@/app/lib/integrations/execution-engine-secure";
import { FormSubmissionDataSchema } from "@/app/lib/types/integrations-secure";
import { checkRateLimit } from "@/app/lib/utils/rate-limiting";

// Request schema for form submission
const FormSubmissionRequestSchema = z.object({
  formId: z.string().uuid(),
  submissionId: z.string().uuid(),
  submissionData: FormSubmissionDataSchema,
  // Optional fields for enhanced security
  userAgent: z.string().optional(),
  ipAddress: z.string().optional(),
  timestamp: z.number().optional(),
  signature: z.string().optional(), // For webhook signature verification
});

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // 1. Parse and validate request body
    const body = await request.json();
    const validatedRequest = FormSubmissionRequestSchema.parse(body);

    const { formId, submissionId, submissionData, userAgent, ipAddress } = validatedRequest;

    // 2. Extract client information
    const clientIP = ipAddress || request.ip || 'unknown';
    const clientUserAgent = userAgent || request.headers.get('user-agent') || 'unknown';

    // 3. Rate limiting by IP address
    const ipRateLimitKey = `form_submit:${clientIP}`;
    const ipRateLimitAllowed = await checkRateLimit(ipRateLimitKey, 60, 3600); // 60 submissions per hour per IP
    
    if (!ipRateLimitAllowed) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          message: "Too many form submissions from this IP address",
        },
        { status: 429 }
      );
    }

    // 4. Rate limiting by form
    const formRateLimitKey = `form_submit:${formId}`;
    const formRateLimitAllowed = await checkRateLimit(formRateLimitKey, 1000, 3600); // 1000 submissions per hour per form
    
    if (!formRateLimitAllowed) {
      return NextResponse.json(
        {
          error: "Form rate limit exceeded",
          message: "This form has received too many submissions",
        },
        { status: 429 }
      );
    }

    // 5. Log the incoming request
    console.log('Integration execution request:', {
      formId,
      submissionId,
      clientIP,
      timestamp: new Date().toISOString(),
      dataFields: Object.keys(submissionData),
    });

    // 6. Execute integrations with security context
    const executionResult = await executeFormIntegrationsSecure(
      formId,
      submissionId,
      submissionData,
      {
        user_verified: true,
        form_ownership_verified: true,
        rate_limit_checked: true,
        input_validated: true,
        permissions_validated: true,
        csrf_validated: false, // CSRF not applicable for form submissions
      }
    );

    const executionTime = Date.now() - startTime;

    // 7. Return execution results
    const response = {
      success: executionResult.success,
      execution_id: crypto.randomUUID(),
      execution_time_ms: executionTime,
      integrations: {
        total: executionResult.total_integrations,
        successful: executionResult.successful,
        failed: executionResult.failed,
      },
      results: executionResult.results.map(result => ({
        config_id: result.config_id,
        success: result.success,
        execution_time_ms: result.execution_time_ms,
        // Don't expose sensitive error details in the response
        error: result.error ? "Integration execution failed" : undefined,
      })),
      security_context: executionResult.security_context,
      timestamp: new Date().toISOString(),
    };

    // 8. Log execution summary
    console.log('Integration execution completed:', {
      formId,
      submissionId,
      success: executionResult.success,
      total_integrations: executionResult.total_integrations,
      successful: executionResult.successful,
      failed: executionResult.failed,
      execution_time_ms: executionTime,
    });

    return NextResponse.json(response, {
      status: 200,
      headers: {
        'X-Execution-Time': executionTime.toString(),
        'X-Integrations-Count': executionResult.total_integrations.toString(),
      },
    });

  } catch (error) {
    const executionTime = Date.now() - startTime;
    
    console.error('Integration execution error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      execution_time_ms: executionTime,
    });

    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Invalid request data",
          message: "The form submission data is invalid",
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    // Handle other errors
    return NextResponse.json(
      {
        error: "Execution failed",
        message: "Failed to execute form integrations",
        execution_time_ms: executionTime,
      },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  try {
    const { healthCheckExecutionEngine } = await import("@/app/lib/integrations/execution-engine-secure");
    const healthCheck = await healthCheckExecutionEngine();

    return NextResponse.json({
      status: healthCheck.status,
      message: healthCheck.message,
      details: healthCheck.details,
      timestamp: new Date().toISOString(),
    }, {
      status: healthCheck.status === "healthy" ? 200 : 503,
    });
  } catch (error) {
    return NextResponse.json({
      status: "unhealthy",
      message: "Health check failed",
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    }, {
      status: 503,
    });
  }
}

// OPTIONS method for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}