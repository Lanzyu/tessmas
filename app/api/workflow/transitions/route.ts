import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookies().getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => cookies().set(name, value, options))
            } catch {
              // The `setAll` method was called from a Server Component.
            }
          },
        },
      },
    )

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { reportId, transitionType, notes, coordinatorId, staffId, todoList } = await request.json()

    // Get user profile
    const { data: profile } = await supabase.from("profiles").select("role, name").eq("id", user.id).single()

    if (!profile) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 })
    }

    // Get current report
    const { data: report } = await supabase.from("reports").select("*").eq("id", reportId).single()

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 })
    }

    // Define workflow transitions
    const workflowTransitions = {
      // TU sends to coordinator
      send_to_coordinator: {
        allowedRoles: ["TU", "Admin"],
        action: "Diteruskan ke koordinator",
        defaultNotes: "Koordinator check dokumen",
        newStatus: "pending_coordinator_review",
        updateReport: { current_holder: null, status: "pending_coordinator_review" },
      },

      // Coordinator assigns to staff
      assign_to_staff: {
        allowedRoles: ["Koordinator", "Admin"],
        action: "Diteruskan ke staff",
        defaultNotes: "Dikerjakan staff",
        newStatus: "in_progress",
        updateReport: { status: "in_progress" },
      },

      // Staff sends back to coordinator
      return_to_coordinator: {
        allowedRoles: ["Staff"],
        action: "Diteruskan ke koordinator",
        defaultNotes: "Check laporan",
        newStatus: "pending_coordinator_review",
        updateReport: { status: "pending_coordinator_review" },
      },

      // Coordinator sends back for revision
      request_revision: {
        allowedRoles: ["Koordinator", "Admin"],
        action: "Dikerjakan staff kembali",
        defaultNotes: "Direvisi",
        newStatus: "revision_required",
        updateReport: { status: "revision_required" },
      },

      // Coordinator completes and returns to TU
      complete_to_tu: {
        allowedRoles: ["Koordinator", "Admin"],
        action: "Dikembalikan ke TU",
        defaultNotes: "Tugas selesai",
        newStatus: "completed",
        updateReport: { status: "completed", current_holder: report.created_by, progress: 100 },
      },
    }

    const transition = workflowTransitions[transitionType]
    if (!transition) {
      return NextResponse.json({ error: "Invalid transition type" }, { status: 400 })
    }

    // Check if user role is allowed for this transition
    if (!transition.allowedRoles.includes(profile.role)) {
      return NextResponse.json(
        {
          error: `Only ${transition.allowedRoles.join(", ")} can perform this action`,
        },
        { status: 403 },
      )
    }

    const algorithmResponse = await fetch(
      `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/task-assignments/algorithm`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: request.headers.get("cookie") || "",
        },
        body: JSON.stringify({
          reportId,
          workflowStep: transitionType,
          coordinatorId,
          staffId,
          todoList,
          notes,
        }),
      },
    )

    if (!algorithmResponse.ok) {
      const errorData = await algorithmResponse.json()
      return NextResponse.json({ error: errorData.error }, { status: algorithmResponse.status })
    }

    const algorithmResult = await algorithmResponse.json()

    return NextResponse.json({
      success: true,
      message: algorithmResult.message,
      newStatus: algorithmResult.newStatus,
      taskAssignment: algorithmResult.taskAssignment,
    })
  } catch (error) {
    console.error("Workflow transition error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
