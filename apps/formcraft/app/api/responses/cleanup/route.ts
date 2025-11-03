import { authErrorResponse, requireAuth } from "@/app/lib/middleware/auth"
import { verifyUserCanAccessFormVersion } from "@/app/lib/middleware/authorization"
import { createServerClient } from "@formlink/db"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

type Body = {
  form_id?: string
  form_version_id?: string
  all?: boolean // Delete all test data across all forms (admin only)
}

export async function DELETE(req: NextRequest) {
  try {
    // Check if test data feature is enabled
    const testDataEnabled =
      process.env.NEXT_PUBLIC_ENABLE_TESTDATA?.toLowerCase() === "true"

    if (!testDataEnabled) {
      return NextResponse.json(
        { error: "Test data feature is not enabled" },
        { status: 403 }
      )
    }

    let auth
    try {
      auth = await requireAuth(req)
    } catch (error) {
      return authErrorResponse({
        name: "AuthError",
        message:
          error instanceof Error ? error.message : "Authentication failed",
        statusCode: 401,
      })
    }

    const body: Body = (await req.json().catch(() => ({}))) || {}
    const cookieStore = await cookies()
    const supabase = await createServerClient(cookieStore)
    // Create service client for deletion operations (bypasses RLS)
    const supabaseService = await createServerClient(null, "service")

    // If 'all' flag is true, delete all test data for the user
    if (body.all) {
      // First, get all forms owned by the user
      const { data: userForms } = await supabase
        .from("forms")
        .select("id")
        .eq("user_id", auth.user.id)

      if (!userForms || userForms.length === 0) {
        return NextResponse.json({
          success: true,
          message: "No forms found for user",
          submissions_deleted: 0,
          answers_deleted: 0,
        })
      }

      const formIds = userForms.map((f: any) => f.id)

      // Get all form versions for these forms
      const { data: formVersions } = await supabase
        .from("form_versions")
        .select("version_id")
        .in("form_id", formIds)

      if (!formVersions || formVersions.length === 0) {
        return NextResponse.json({
          success: true,
          message: "No form versions found",
          submissions_deleted: 0,
          answers_deleted: 0,
        })
      }

      const versionIds = formVersions.map(
        (v: { version_id: string }) => v.version_id
      )

      // Get all test submissions for these versions
      const { data: testSubmissions, error: fetchError } = await supabase
        .from("form_submissions")
        .select("submission_id")
        .in("form_version_id", versionIds)
        .eq("testmode", true)

      if (fetchError) {
        console.error("Error fetching test submissions:", fetchError)
        return NextResponse.json(
          {
            error: "Failed to fetch test submissions",
            details: fetchError.message,
          },
          { status: 500 }
        )
      }

      if (!testSubmissions || testSubmissions.length === 0) {
        return NextResponse.json({
          success: true,
          message: "No test data found to delete",
          submissions_deleted: 0,
          answers_deleted: 0,
        })
      }

      const submissionIds = testSubmissions.map(
        (s: { submission_id: string }) => s.submission_id
      )

      // Count and delete answers first
      const { data: answersToDelete } = await supabase
        .from("form_answers")
        .select("id")
        .in("submission_id", submissionIds)

      const answersCount = answersToDelete?.length || 0

      if (answersCount > 0) {
        await supabaseService
          .from("form_answers")
          .delete()
          .in("submission_id", submissionIds)
      }

      // Delete submission_messages (foreign key dependency)
      await supabaseService
        .from("submission_messages")
        .delete()
        .in("submission_id", submissionIds)

      // Delete submissions
      const submissionsCount = testSubmissions.length
      await supabaseService
        .from("form_submissions")
        .delete()
        .in("submission_id", submissionIds)

      return NextResponse.json({
        success: true,
        message: `Deleted all test data for user's forms`,
        submissions_deleted: submissionsCount,
        answers_deleted: answersCount,
      })
    }

    // Handle deletion for specific form or form version
    const formVersionId = body.form_version_id || null

    if (!formVersionId && body.form_id) {
      // Get all versions for this form
      const { data: versions } = await supabase
        .from("form_versions")
        .select("version_id")
        .eq("form_id", body.form_id)

      if (!versions || versions.length === 0) {
        return NextResponse.json({
          success: true,
          message: "No form versions found",
          submissions_deleted: 0,
          answers_deleted: 0,
        })
      }

      // Verify user has access to this form
      const { data: form } = await supabase
        .from("forms")
        .select("user_id")
        .eq("id", body.form_id)
        .single()

      if (!form || form.user_id !== auth.user.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
      }

      // Delete test data for all versions of this form
      const versionIds = versions.map(
        (v: { version_id: string }) => v.version_id
      )

      // Get all test submissions
      const { data: testSubmissions, error: fetchError } = await supabase
        .from("form_submissions")
        .select("submission_id")
        .in("form_version_id", versionIds)
        .eq("testmode", true)

      if (fetchError) {
        console.error("Error fetching test submissions:", fetchError)
        return NextResponse.json(
          {
            error: "Failed to fetch test submissions",
            details: fetchError.message,
          },
          { status: 500 }
        )
      }

      if (!testSubmissions || testSubmissions.length === 0) {
        return NextResponse.json({
          success: true,
          message: "No test data found to delete",
          submissions_deleted: 0,
          answers_deleted: 0,
        })
      }

      const submissionIds = testSubmissions.map(
        (s: { submission_id: string }) => s.submission_id
      )

      // Delete answers first (select to count before deleting)
      const { data: answersToDelete } = await supabase
        .from("form_answers")
        .select("id")
        .in("submission_id", submissionIds)

      const answersCount = answersToDelete?.length || 0

      if (answersCount > 0) {
        const { error: answerDeleteError } = await supabaseService
          .from("form_answers")
          .delete()
          .in("submission_id", submissionIds)

        if (answerDeleteError) {
          console.error("Error deleting answers:", answerDeleteError)
        }
      }

      // Delete submission_messages (foreign key dependency)
      const { error: messagesDeleteError } = await supabaseService
        .from("submission_messages")
        .delete()
        .in("submission_id", submissionIds)

      if (messagesDeleteError) {
        console.error(
          "Error deleting submission messages:",
          messagesDeleteError
        )
      }

      // Delete submissions using service client
      const submissionsCount = testSubmissions.length

      const { error: submissionDeleteError } = await supabaseService
        .from("form_submissions")
        .delete()
        .in("submission_id", submissionIds)
        .select() // Add select to return deleted rows

      if (submissionDeleteError) {
        console.error("Error deleting submissions:", submissionDeleteError)
        return NextResponse.json(
          {
            error: "Failed to delete submissions",
            details: submissionDeleteError.message,
          },
          { status: 500 }
        )
      }

      // Verify deletion
      await supabase
        .from("form_submissions")
        .select("submission_id")
        .in("submission_id", submissionIds.slice(0, 5))
        .eq("testmode", true)

      return NextResponse.json({
        success: true,
        message: `Deleted test data for form ${body.form_id}`,
        submissions_deleted: submissionsCount,
        answers_deleted: answersCount,
      })
    }

    // Handle specific form version
    if (!formVersionId) {
      return NextResponse.json(
        { error: "Provide form_id or form_version_id" },
        { status: 400 }
      )
    }

    // Verify user has access to this form version
    const hasAccess = await verifyUserCanAccessFormVersion(
      formVersionId,
      auth.user.id
    )
    if (!hasAccess) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // Get all test submissions for this version
    const { data: testSubmissions, error: fetchError } = await supabase
      .from("form_submissions")
      .select("submission_id")
      .eq("form_version_id", formVersionId)
      .eq("testmode", true)

    if (fetchError) {
      console.error("Error fetching test submissions:", fetchError)
      return NextResponse.json(
        {
          error: "Failed to fetch test submissions",
          details: fetchError.message,
        },
        { status: 500 }
      )
    }

    if (!testSubmissions || testSubmissions.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No test data found to delete",
        submissions_deleted: 0,
        answers_deleted: 0,
      })
    }

    const submissionIds = testSubmissions.map(
      (s: { submission_id: string }) => s.submission_id
    )

    // Count and delete answers first
    const { data: answersToDelete } = await supabase
      .from("form_answers")
      .select("id")
      .in("submission_id", submissionIds)

    const answersCount = answersToDelete?.length || 0

    if (answersCount > 0) {
      await supabaseService
        .from("form_answers")
        .delete()
        .in("submission_id", submissionIds)
    }

    // Delete submission_messages (foreign key dependency)
    await supabaseService
      .from("submission_messages")
      .delete()
      .in("submission_id", submissionIds)

    // Delete submissions
    const submissionsCount = testSubmissions.length
    await supabaseService
      .from("form_submissions")
      .delete()
      .in("submission_id", submissionIds)

    return NextResponse.json({
      success: true,
      message: `Deleted test data for form version ${formVersionId}`,
      submissions_deleted: submissionsCount,
      answers_deleted: answersCount,
    })
  } catch (e) {
    console.error("Error deleting test data:", e)
    return NextResponse.json(
      {
        error: "Failed to delete test data",
        details: e instanceof Error ? e.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
