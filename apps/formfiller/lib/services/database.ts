import { createBrowserClient, SupabaseClient } from "@formlink/db";
import { v4 as uuidv4 } from "uuid";

/**
 * Database service for FormLink app file handling.
 * Contains all database-related operations for file uploads and chat attachments.
 */

function createClient() {
  return createBrowserClient();
}

export type Attachment = {
  name: string;
  contentType: string;
  url: string;
};

/**
 * Upload file to Supabase storage
 */
export async function uploadFile(
  supabase: SupabaseClient,
  file: File
): Promise<string> {
  const fileExt = file.name.split(".").pop();
  const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
  const filePath = `uploads/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from("chat-attachments")
    .upload(filePath, file);

  if (uploadError) {
    throw new Error(`Error uploading file: ${uploadError.message}`);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("chat-attachments").getPublicUrl(filePath);

  return publicUrl;
}

/**
 * Create attachment object from file and URL
 */
export function createAttachment(file: File, url: string): Attachment {
  return {
    name: file.name,
    contentType: file.type,
    url: url,
  };
}

/**
 * Process multiple files for chat attachments
 */
export async function processFiles(
  files: File[],
  chatId: string,
  userId: string,
  validateFile: (file: File) => { isValid: boolean; error?: string },
  onValidationError: (error: string) => void
): Promise<Attachment[]> {
  const supabase = createClient();
  const attachments: Attachment[] = [];

  for (const file of files) {
    const validation = validateFile(file);
    if (!validation.isValid) {
      console.warn(`File ${file.name} validation failed:`, validation.error);
      onValidationError(validation.error || "File validation failed");
      continue;
    }

    try {
      const url = await uploadFile(supabase, file);

      const { error } = await supabase.from("submission_chat_attachments").insert({
        chat_id: chatId,
        user_id: userId,
        file_url: url,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
      });

      if (error) throw new Error(`Database insertion failed: ${error.message}`);

      const attachment = createAttachment(file, url);
      attachments.push(attachment);
    } catch (error) {
      console.error(`Error processing file ${file.name}:`, error);
    }
  }

  return attachments;
}

export class FileUploadLimitError extends Error {
  code: string;
  constructor(message: string) {
    super(message);
    this.code = "DAILY_FILE_LIMIT_REACHED";
  }
}

/**
 * Check if user has reached daily file upload limit
 */
export async function checkFileUploadLimit(
  userId: string,
  dailyLimit: number
) {
  const supabase = createClient();
  const now = new Date();
  const startOfToday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  const startOfTodayISO = startOfToday.toISOString();

  const { count, error } = await supabase
    .from("submission_chat_attachments")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startOfTodayISO);

  if (error) {
    throw new Error(error.message);
  }

  if (count && count >= dailyLimit) {
    throw new FileUploadLimitError("Daily file upload limit reached.");
  }

  return count;
}