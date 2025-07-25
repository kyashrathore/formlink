import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client for server-side operations
function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase environment variables");
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function validateUserFormOwnership(
  userId: string,
  formId: string,
): Promise<boolean> {
  if (!userId || !formId) {
    return false;
  }

  try {
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from("forms")
      .select("created_by")
      .eq("id", formId)
      .eq("created_by", userId)
      .single();

    return !error && !!data;
  } catch (error) {
    console.error("Failed to validate form ownership:", error);
    return false;
  }
}

export async function validateUserIntegrationOwnership(
  userId: string,
  integrationId: string,
): Promise<boolean> {
  if (!userId || !integrationId) {
    return false;
  }

  try {
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from("user_integrations")
      .select("user_id")
      .eq("id", integrationId)
      .eq("user_id", userId)
      .single();

    return !error && !!data;
  } catch (error) {
    console.error("Failed to validate integration ownership:", error);
    return false;
  }
}

export async function validateFormIntegrationConfigOwnership(
  userId: string,
  configId: string,
): Promise<boolean> {
  if (!userId || !configId) {
    return false;
  }

  try {
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from("form_integration_configs")
      .select("user_id")
      .eq("id", configId)
      .eq("user_id", userId)
      .single();

    return !error && !!data;
  } catch (error) {
    console.error("Failed to validate form integration config ownership:", error);
    return false;
  }
}

export async function getUserActiveIntegration(
  userId: string,
  toolkit: string,
): Promise<{
  id: string;
  composio_connection_id: string;
  granted_scopes: string[];
  connection_metadata: Record<string, unknown>;
} | null> {
  if (!userId || !toolkit) {
    return null;
  }

  try {
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from("user_integrations")
      .select("id, composio_connection_id, granted_scopes, connection_metadata")
      .eq("user_id", userId)
      .eq("toolkit", toolkit)
      .eq("connection_status", "active")
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      composio_connection_id: data.composio_connection_id,
      granted_scopes: data.granted_scopes || [],
      connection_metadata: data.connection_metadata || {},
    };
  } catch (error) {
    console.error("Failed to get user active integration:", error);
    return null;
  }
}

export async function getFormIntegrationConfigs(
  formId: string,
  userId?: string,
): Promise<Array<{
  id: string;
  toolkit: string;
  action_type: string;
  target_config: Record<string, unknown>;
  field_mappings: Record<string, unknown>;
  message_template?: string;
  is_active: boolean;
  execution_order: number;
}>> {
  if (!formId) {
    return [];
  }

  try {
    const supabase = createServerClient();

    let query = supabase
      .from("form_integration_configs")
      .select(`
        id,
        toolkit,
        action_type,
        target_config,
        field_mappings,
        message_template,
        is_active,
        execution_order
      `)
      .eq("form_id", formId)
      .eq("is_active", true)
      .order("execution_order");

    // If userId is provided, also filter by user ownership
    if (userId) {
      query = query.eq("user_id", userId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Failed to get form integration configs:", error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error("Failed to get form integration configs:", error);
    return [];
  }
}

export async function validateUserCanAccessForm(
  userId: string,
  formId: string,
): Promise<{
  canAccess: boolean;
  isOwner: boolean;
  form?: {
    id: string;
    title: string;
    created_by: string;
  };
}> {
  if (!userId || !formId) {
    return { canAccess: false, isOwner: false };
  }

  try {
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from("forms")
      .select("id, title, created_by")
      .eq("id", formId)
      .single();

    if (error || !data) {
      return { canAccess: false, isOwner: false };
    }

    const isOwner = data.created_by === userId;
    // For now, only owners can access forms
    // This could be extended to include collaborators, etc.
    const canAccess = isOwner;

    return {
      canAccess,
      isOwner,
      form: data,
    };
  } catch (error) {
    console.error("Failed to validate user form access:", error);
    return { canAccess: false, isOwner: false };
  }
}