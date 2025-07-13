import { createServerClient } from "@formlink/db";
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: Request) {
  // Using service role client to allow anonymous form submissions
  // Forms can be filled by users who are not logged in
  const supabase = await createServerClient(null, "service");

  const formData = await request.formData();
  const file = formData.get("file") as File;
  const formId = formData.get("formId") as string;
  const submissionId = formData.get("submissionId") as string;
  const questionId = formData.get("questionId") as string;

  if (!file || !formId || !submissionId || !questionId) {
    return NextResponse.json(
      { error: "Missing required fields." },
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

  try {
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("form-submissions-uploads")
      .upload(filePath, file);

    if (uploadError) {
      console.error("Supabase upload error:", uploadError);
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
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
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 },
    );
  }
}
