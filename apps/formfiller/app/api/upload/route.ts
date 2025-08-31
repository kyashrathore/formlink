import { createServerClient } from "@formlink/db";
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: Request) {
  try {
    // Using service role client to allow anonymous form submissions
    // Forms can be filled by users who are not logged in
    const supabase = await createServerClient(null, "service");

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const formId = formData.get("formId") as string;
    const submissionId = formData.get("submissionId") as string;
    const questionId = formData.get("questionId") as string;

    if (!file || !formId || !submissionId || !questionId) {
      const missingFields = [];
      if (!file) missingFields.push("file");
      if (!formId) missingFields.push("formId");
      if (!submissionId) missingFields.push("submissionId");
      if (!questionId) missingFields.push("questionId");

      return NextResponse.json(
        { error: `Missing required fields: ${missingFields.join(", ")}` },
        { status: 400 },
      );
    }

    // Validate file extension
    const allowedExtensions = [
      "jpg",
      "jpeg",
      "png",
      "gif",
      "pdf",
      "doc",
      "docx",
      "txt",
    ];

    // Defensive check: ensure file.name exists before calling split
    if (!file.name) {
      return NextResponse.json(
        { error: "File is missing a name property" },
        { status: 400 },
      );
    }

    const fileExtension = file.name.split(".").pop()?.toLowerCase();

    if (!fileExtension || !allowedExtensions.includes(fileExtension)) {
      return NextResponse.json(
        {
          error:
            "Invalid file type. Allowed types: " + allowedExtensions.join(", "),
        },
        { status: 400 },
      );
    }

    const fileName = `${uuidv4()}.${fileExtension}`;
    const filePath = `${formId}/${submissionId}+${questionId}_${fileName}`;
    const { error: uploadError } = await supabase.storage
      .from("form-submissions-uploads")
      .upload(filePath, file);

    if (uploadError) {
      console.error("Supabase upload error:", uploadError);
      console.error("Upload error details:", uploadError);
      return NextResponse.json(
        {
          error: uploadError.message || "Failed to upload file to storage",
        },
        { status: 500 },
      );
    }

    const { data: publicUrlData } = supabase.storage
      .from("form-submissions-uploads")
      .getPublicUrl(filePath);

    if (!publicUrlData) {
      return NextResponse.json(
        { error: "Could not get public URL." },
        { status: 500 },
      );
    }

    // Check if submission exists
    const { data: existingSubmission } = await supabase
      .from("form_submissions")
      .select("submission_id")
      .eq("submission_id", submissionId)
      .single();

    if (!existingSubmission) {
      return NextResponse.json(
        {
          error:
            "Please answer at least one question before uploading files. The form submission must be created first.",
          code: "SUBMISSION_REQUIRED",
        },
        { status: 400 },
      );
    }

    const attachmentData = {
      submission_id: submissionId,
      file_name: file.name,
      file_type: file.type,
      file_size: file.size,
      file_url: publicUrlData.publicUrl,
    };

    const { error: dbError } = await supabase
      .from("submission_chat_attachments")
      .insert(attachmentData);

    if (dbError) {
      console.error("Supabase db insert error:", dbError);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json({
      message: "File uploaded successfully.",
      filePath: filePath,
      publicUrl: publicUrlData.publicUrl,
      url: publicUrlData.publicUrl, // Add url field for compatibility
      fileName: file.name,
      fileSize: file.size,
    });
  } catch (error) {
    console.error("Upload error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unexpected error occurred";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
