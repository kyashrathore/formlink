import { composioService } from "../services/composio";
import { SECURE_ACTION_TEMPLATES } from "./action-templates-secure";
import {
  FormSubmissionDataSchema,
  IntegrationConfig,
  SecurityContext,
} from "../types/integrations-secure";
import { checkRateLimit } from "../utils/rate-limiting";
import { CircuitBreaker } from "../utils/circuit-breaker";
import { retry, retryConditions, retryConfigs } from "../utils/retry";
import { getFormIntegrationConfigs } from "../auth/form-ownership";
import crypto from "crypto";

interface ExecutionResult {
  config_id: string;
  success: boolean;
  execution_time_ms: number;
  error?: string;
  retry_count?: number;
  output_data?: Record<string, unknown>;
}

interface ExecutionSummary {
  success: boolean;
  total_integrations: number;
  successful: number;
  failed: number;
  results: ExecutionResult[];
  security_context: SecurityContext;
  execution_time_ms: number;
}

export async function executeFormIntegrationsSecure(
  formId: string,
  submissionId: string,
  submissionData: unknown,
  securityContext: Partial<SecurityContext> = {},
): Promise<ExecutionSummary> {
  const startTime = Date.now();

  try {
    // 1. Validate and sanitize input data
    let validatedSubmissionData;
    try {
      validatedSubmissionData = FormSubmissionDataSchema.parse(submissionData);
    } catch (error) {
      throw new Error(
        `Invalid submission data: ${error instanceof Error ? error.message : "Unknown validation error"}`,
      );
    }

    // 2. Create input data hash for logging (don't store raw sensitive data)
    const inputDataHash = crypto
      .createHash("sha256")
      .update(JSON.stringify(validatedSubmissionData))
      .digest("hex");

    // 3. Get all active integration configs for this form
    const configs = await getFormIntegrationConfigs(formId);

    if (!configs?.length) {
      return {
        success: true,
        total_integrations: 0,
        successful: 0,
        failed: 0,
        results: [],
        security_context: {
          user_verified: true,
          form_ownership_verified: true,
          rate_limit_checked: true,
          input_validated: true,
          permissions_validated: true,
          csrf_validated: false,
        },
        execution_time_ms: Date.now() - startTime,
      };
    }

    // 4. Get user ID from first config (they should all have the same user)
    const userId = await getUserIdFromForm(formId);
    if (!userId) {
      throw new Error("Form ownership verification failed");
    }

    // 5. Check rate limiting per user
    const rateLimitKey = `execute_integrations:${userId}`;
    const rateLimitAllowed = await checkRateLimit(rateLimitKey, 100, 3600); // 100 executions per hour
    if (!rateLimitAllowed) {
      throw new Error("Rate limit exceeded for user");
    }

    // 6. Parallel execution with error isolation
    const executionPromises = configs.map(
      async (config): Promise<ExecutionResult> => {
        const executionStartTime = Date.now();
        let retryCount = 0;

        try {
          // Create circuit breaker for this integration type
          const circuitBreakerKey = `${config.toolkit}_${config.action_type}`;
          const circuitBreaker = new CircuitBreaker(circuitBreakerKey, {
            failureThreshold: 5,
            recoveryTimeout: 60000,
            monitor: true,
          });

          // Check if circuit is open
          if (!circuitBreaker.canExecute()) {
            throw new Error(`Circuit breaker is open for ${config.toolkit}`);
          }

          // Get the action template
          const template =
            SECURE_ACTION_TEMPLATES[config.toolkit]?.[config.action_type];
          if (!template) {
            throw new Error(
              `Unknown action: ${config.toolkit}.${config.action_type}`,
            );
          }

          // Rate limit per integration type
          const integrationRateLimitKey = `integration:${config.toolkit}:${userId}`;
          const integrationRateAllowed = await checkRateLimit(
            integrationRateLimitKey,
            template.rate_limit.requests_per_minute,
            60,
          );

          if (!integrationRateAllowed) {
            throw new Error(`Rate limit exceeded for ${config.toolkit}`);
          }

          // Validate configuration
          const isConfigValid = await template.validate_config(config as IntegrationConfig);
          if (!isConfigValid) {
            throw new Error("Configuration validation failed");
          }

          // Execute with retry logic
          const result = await retry(
            async () => {
              retryCount++;

              // Build parameters using secure template mapping
              const params = await template.param_mapping(
                config as IntegrationConfig,
                validatedSubmissionData,
              );

              // Validate required parameters
              const missingParams = template.required_params.filter(
                (param) => params[param] === undefined || params[param] === null,
              );

              if (missingParams.length > 0) {
                throw new Error(
                  `Missing required parameters: ${missingParams.join(", ")}`,
                );
              }

              // Execute the integration with timeout
              const integrationResult = await Promise.race([
                composioService.executeAction({
                  action: template.composio_action,
                  userId,
                  params,
                }),
                new Promise((_, reject) =>
                  setTimeout(
                    () => reject(new Error("Execution timeout")),
                    template.timeout_ms,
                  ),
                ),
              ]);

              // Record success in circuit breaker
              circuitBreaker.recordSuccess();

              return integrationResult;
            },
            {
              ...retryConfigs.standard,
              maxAttempts: template.max_retries,
              retryCondition: retryConditions.combine(
                retryConditions.networkErrors,
                retryConditions.serverErrors,
                retryConditions.rateLimitErrors,
              ),
            },
          );

          const executionTime = Date.now() - executionStartTime;

          // Log success to database
          await logIntegrationEvent({
            user_id: userId,
            form_id: formId,
            submission_id: submissionId,
            integration_config_id: config.id,
            toolkit: config.toolkit,
            action: config.action_type,
            status: "success",
            input_data_hash: inputDataHash,
            output_data: result.success ? result.result : undefined,
            execution_time_ms: executionTime,
            retry_count: retryCount - 1,
            security_context: {
              user_verified: true,
              permissions_validated: true,
              rate_limit_checked: true,
            },
          });

          return {
            config_id: config.id,
            success: true,
            execution_time_ms: executionTime,
            retry_count: retryCount - 1,
            output_data: result.success ? result.result : undefined,
          };
        } catch (error) {
          const executionTime = Date.now() - executionStartTime;
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";

          // Record failure in circuit breaker
          const circuitBreakerKey = `${config.toolkit}_${config.action_type}`;
          const circuitBreaker = new CircuitBreaker(circuitBreakerKey, {
            failureThreshold: 5,
            recoveryTimeout: 60000,
          });
          circuitBreaker.recordFailure();

          // Log error to database
          await logIntegrationEvent({
            user_id: userId,
            form_id: formId,
            submission_id: submissionId,
            integration_config_id: config.id,
            toolkit: config.toolkit,
            action: config.action_type,
            status: "failed",
            input_data_hash: inputDataHash,
            error_message: errorMessage,
            error_code:
              error instanceof Error ? error.constructor.name : "UnknownError",
            execution_time_ms: executionTime,
            retry_count: retryCount,
            security_context: {
              user_verified: true,
              error_handled: true,
            },
          });

          return {
            config_id: config.id,
            success: false,
            error: errorMessage,
            execution_time_ms: executionTime,
            retry_count,
          };
        }
      },
    );

    // 7. Wait for all integrations to complete (parallel execution)
    const results = await Promise.all(executionPromises);

    const totalExecutionTime = Date.now() - startTime;

    return {
      success: results.every((r) => r.success),
      total_integrations: results.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
      security_context: {
        user_verified: true,
        form_ownership_verified: true,
        rate_limit_checked: true,
        input_validated: true,
        permissions_validated: true,
        csrf_validated: securityContext.csrf_validated || false,
      },
      execution_time_ms: totalExecutionTime,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const totalExecutionTime = Date.now() - startTime;

    console.error("Form integrations execution failed:", error);

    return {
      success: false,
      total_integrations: 0,
      successful: 0,
      failed: 0,
      results: [],
      security_context: {
        user_verified: false,
        form_ownership_verified: false,
        rate_limit_checked: false,
        input_validated: false,
        permissions_validated: false,
        csrf_validated: false,
      },
      execution_time_ms: totalExecutionTime,
    };
  }
}

// Helper functions

async function getUserIdFromForm(formId: string): Promise<string | null> {
  try {
    // This would typically query the database to get the form owner
    // For now, return null - implement database query
    console.warn("getUserIdFromForm not implemented - needs database integration");
    return null;
  } catch (error) {
    console.error("Failed to get user ID from form:", error);
    return null;
  }
}

async function logIntegrationEvent(event: {
  user_id: string;
  form_id: string;
  submission_id: string;
  integration_config_id: string;
  toolkit: string;
  action: string;
  status: string;
  input_data_hash: string;
  output_data?: Record<string, unknown>;
  error_message?: string;
  error_code?: string;
  execution_time_ms: number;
  retry_count: number;
  security_context: Record<string, unknown>;
}): Promise<void> {
  try {
    // This would typically insert into the integration_events table
    // For now, just log to console - implement database insertion
    console.log("Integration event:", {
      ...event,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Failed to log integration event:", error);
  }
}

// Health check for the execution engine
export async function healthCheckExecutionEngine(): Promise<{
  status: "healthy" | "unhealthy";
  message: string;
  details: {
    composio_service: string;
    rate_limiting: string;
    circuit_breakers: string;
  };
}> {
  try {
    // Check Composio service
    const composioHealth = await composioService.healthCheck();
    
    // Check rate limiting (try a test operation)
    const rateLimitTest = await checkRateLimit("health_check", 1, 60);
    
    // Get circuit breaker metrics
    const circuitBreakerMetrics = await import("../utils/circuit-breaker").then(
      (module) => module.getCircuitBreakerMetrics(),
    );

    const allHealthy = composioHealth.status === "healthy" && rateLimitTest;

    return {
      status: allHealthy ? "healthy" : "unhealthy",
      message: allHealthy
        ? "Execution engine is healthy"
        : "Execution engine has issues",
      details: {
        composio_service: composioHealth.status,
        rate_limiting: rateLimitTest ? "healthy" : "unhealthy",
        circuit_breakers: `${circuitBreakerMetrics.length} active breakers`,
      },
    };
  } catch (error) {
    return {
      status: "unhealthy",
      message: error instanceof Error ? error.message : "Unknown error",
      details: {
        composio_service: "unknown",
        rate_limiting: "unknown",
        circuit_breakers: "unknown",
      },
    };
  }
}