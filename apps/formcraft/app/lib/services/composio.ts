import { ComposioToolSet } from "composio-core";
import { ComposioExecutionResult } from "../types/integrations-secure";

export interface ComposioActionParams {
  action: string;
  userId: string;
  params: Record<string, unknown>;
}

export interface ComposioAuthParams {
  userId: string;
  toolkit: string;
  redirectUrl?: string;
  scopes?: string[];
}

class ComposioService {
  private toolset: ComposioToolSet;
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.COMPOSIO_API_KEY!;
    if (!this.apiKey) {
      throw new Error("COMPOSIO_API_KEY environment variable is required");
    }
    this.toolset = new ComposioToolSet({
      apiKey: this.apiKey,
    });
  }

  /**
   * Execute a Composio action with security validation
   */
  async executeAction({
    action,
    userId,
    params,
  }: ComposioActionParams): Promise<ComposioExecutionResult> {
    try {
      // Validate user connection exists
      const connection = await this.getActiveConnection(userId, this.extractToolkitFromAction(action));
      if (!connection) {
        throw new Error("User connection not found or inactive");
      }

      // Execute the action using the connection ID
      const result = await this.toolset.executeAction({
        action,
        params: {
          ...params,
          connectionId: connection.composio_connection_id,
        },
      });

      return {
        success: true,
        result: result.data,
        execution_id: result.execution_id,
      };
    } catch (error) {
      console.error("Composio action execution failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Initiate OAuth connection for a user
   */
  async initiateConnection({
    userId,
    toolkit,
    redirectUrl,
    scopes,
  }: ComposioAuthParams): Promise<{
    authUrl: string;
    connectionId: string;
  }> {
    try {
      const result = await this.toolset.initiateConnection({
        toolKit: toolkit,
        entityId: userId,
        redirectUrl: redirectUrl || `${process.env.NEXT_PUBLIC_APP_URL}/integrations/callback`,
        config: scopes ? { scopes } : undefined,
      });

      return {
        authUrl: result.redirectUrl,
        connectionId: result.connectionId,
      };
    } catch (error) {
      console.error("Failed to initiate Composio connection:", error);
      throw new Error("Failed to initiate connection");
    }
  }

  /**
   * Get connection status and details
   */
  async getConnectionStatus(connectionId: string): Promise<{
    status: string;
    isActive: boolean;
    metadata?: Record<string, unknown>;
  }> {
    try {
      const connection = await this.toolset.getConnection(connectionId);
      return {
        status: connection.status,
        isActive: connection.status === "ACTIVE",
        metadata: connection.metadata,
      };
    } catch (error) {
      console.error("Failed to get connection status:", error);
      return {
        status: "ERROR",
        isActive: false,
      };
    }
  }

  /**
   * List available actions for a toolkit
   */
  async getToolkitActions(toolkit: string): Promise<Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }>> {
    try {
      const actions = await this.toolset.getTools({
        apps: [toolkit],
      });

      return actions.map(action => ({
        name: action.name,
        description: action.description,
        parameters: action.parameters,
      }));
    } catch (error) {
      console.error("Failed to get toolkit actions:", error);
      return [];
    }
  }

  /**
   * Revoke a connection
   */
  async revokeConnection(connectionId: string): Promise<boolean> {
    try {
      await this.toolset.deleteConnection(connectionId);
      return true;
    } catch (error) {
      console.error("Failed to revoke connection:", error);
      return false;
    }
  }

  /**
   * Validate user has required scopes for an action
   */
  async validateScopes(
    userId: string,
    toolkit: string,
    requiredScopes: string[]
  ): Promise<boolean> {
    try {
      const connection = await this.getActiveConnection(userId, toolkit);
      if (!connection) return false;

      const connectionDetails = await this.getConnectionStatus(connection.composio_connection_id);
      if (!connectionDetails.isActive) return false;

      // Get granted scopes from connection metadata
      const grantedScopes = connection.granted_scopes || [];
      
      // Check if all required scopes are granted
      return requiredScopes.every(scope => grantedScopes.includes(scope));
    } catch (error) {
      console.error("Failed to validate scopes:", error);
      return false;
    }
  }

  /**
   * Get active connection for user and toolkit from database
   */
  private async getActiveConnection(
    userId: string,
    toolkit: string
  ): Promise<{
    composio_connection_id: string;
    granted_scopes: string[];
  } | null> {
    // This would typically query the database
    // For now, return null - implement database query
    console.warn("getActiveConnection not implemented - needs database integration");
    return null;
  }

  /**
   * Extract toolkit name from action string
   */
  private extractToolkitFromAction(action: string): string {
    // Actions are typically in format "TOOLKIT_ACTION_NAME"
    return action.split("_")[0];
  }

  /**
   * Health check for Composio service
   */
  async healthCheck(): Promise<{
    status: "healthy" | "unhealthy";
    message: string;
  }> {
    try {
      // Try to get available apps as a health check
      const apps = await this.toolset.getApps();
      return {
        status: "healthy",
        message: `Connected to Composio with ${apps.length} available apps`,
      };
    } catch (error) {
      return {
        status: "unhealthy",
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

// Export singleton instance
export const composioService = new ComposioService();