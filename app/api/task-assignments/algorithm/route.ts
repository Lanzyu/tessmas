import { createServerClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const supabase = createServerClient(cookieStore)

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { reportId, workflowStep, coordinatorId, staffId, todoList, notes } = await request.json()

    // Get user profile
    const { data: profile } = await supabase.from("profiles").select("role, name").eq("id", user.id).single()

    if (!profile) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 })
    }

    // Get report details
    const { data: report } = await supabase.from("reports").select("*").eq("id", reportId).single()

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 })
    }

    let taskAssignment = null
    let workflowAction = ""
    let newStatus = ""
    let updateData = {}

    switch (workflowStep) {
      case "tu_to_coordinator":
        // Step 1: TU creates report and forwards to coordinator
        if (!["TU", "Admin"].includes(profile.role)) {
          return NextResponse.json({ error: "Only TU can forward to coordinator" }, { status: 403 })
        }

        // Create initial task assignment for coordinator review
        const { data: coordinatorTask, error: coordError } = await supabase
          .from("task_assignments")
          .insert({
            report_id: reportId,
            staff_id: coordinatorId,
            coordinator_id: user.id, // TU acts as assigner
            todo_list: JSON.stringify(["Review dokumen", "Tentukan staff yang akan mengerjakan", "Buat rencana kerja"]),
            completed_tasks: JSON.stringify([]),
            progress: 0,
            status: "pending",
            notes: notes || "Dokumen dari TU untuk direview koordinator",
          })
          .select()
          .single()

        if (coordError) {
          return NextResponse.json({ error: "Failed to create coordinator task" }, { status: 500 })
        }

        taskAssignment = coordinatorTask
        workflowAction = "Diteruskan ke koordinator untuk review"
        newStatus = "pending_coordinator_review"
        updateData = { current_holder: coordinatorId, status: "pending_coordinator_review" }
        break

      case "coordinator_to_staff":
        // Step 2: Coordinator assigns to staff
        if (!["Koordinator", "Admin"].includes(profile.role)) {
          return NextResponse.json({ error: "Only coordinator can assign to staff" }, { status: 403 })
        }

        // Update coordinator task as completed
        await supabase
          .from("task_assignments")
          .update({
            status: "completed",
            progress: 100,
            completed_at: new Date().toISOString(),
            completed_tasks: JSON.stringify([
              "Review dokumen",
              "Tentukan staff yang akan mengerjakan",
              "Buat rencana kerja",
            ]),
          })
          .eq("report_id", reportId)
          .eq("staff_id", user.id)

        // Create staff task assignment
        const { data: staffTask, error: staffError } = await supabase
          .from("task_assignments")
          .insert({
            report_id: reportId,
            staff_id: staffId,
            coordinator_id: user.id,
            todo_list: JSON.stringify(
              todoList || ["Kerjakan tugas sesuai instruksi", "Siapkan laporan hasil", "Koordinasi jika ada kendala"],
            ),
            completed_tasks: JSON.stringify([]),
            progress: 0,
            status: "in_progress",
            notes: notes || "Tugas dari koordinator untuk dikerjakan staff",
          })
          .select()
          .single()

        if (staffError) {
          return NextResponse.json({ error: "Failed to create staff task" }, { status: 500 })
        }

        taskAssignment = staffTask
        workflowAction = "Ditugaskan ke staff untuk dikerjakan"
        newStatus = "in_progress"
        updateData = { current_holder: staffId, status: "in_progress" }
        break

      case "staff_to_coordinator":
        // Step 3: Staff completes and returns to coordinator
        if (profile.role !== "Staff") {
          return NextResponse.json({ error: "Only staff can return to coordinator" }, { status: 403 })
        }

        // Update staff task as completed
        const { data: completedStaffTask, error: updateStaffError } = await supabase
          .from("task_assignments")
          .update({
            status: "completed",
            progress: 100,
            completed_at: new Date().toISOString(),
            notes: notes || "Tugas selesai dikerjakan, dikembalikan ke koordinator",
          })
          .eq("report_id", reportId)
          .eq("staff_id", user.id)
          .select()
          .single()

        if (updateStaffError) {
          return NextResponse.json({ error: "Failed to update staff task" }, { status: 500 })
        }

        // Create coordinator review task
        const { data: reviewTask, error: reviewError } = await supabase
          .from("task_assignments")
          .insert({
            report_id: reportId,
            staff_id: completedStaffTask.coordinator_id, // Coordinator becomes the assignee
            coordinator_id: user.id, // Staff acts as assigner for tracking
            todo_list: JSON.stringify(["Review hasil kerja staff", "Validasi kelengkapan", "Tentukan tindak lanjut"]),
            completed_tasks: JSON.stringify([]),
            progress: 0,
            status: "pending",
            notes: notes || "Hasil kerja staff untuk direview koordinator",
          })
          .select()
          .single()

        if (reviewError) {
          return NextResponse.json({ error: "Failed to create review task" }, { status: 500 })
        }

        taskAssignment = reviewTask
        workflowAction = "Dikembalikan ke koordinator untuk review"
        newStatus = "pending_coordinator_review"
        updateData = { current_holder: completedStaffTask.coordinator_id, status: "pending_coordinator_review" }
        break

      case "coordinator_to_tu":
        // Step 4: Coordinator completes and returns to TU
        if (!["Koordinator", "Admin"].includes(profile.role)) {
          return NextResponse.json({ error: "Only coordinator can return to TU" }, { status: 403 })
        }

        // Update coordinator review task as completed
        await supabase
          .from("task_assignments")
          .update({
            status: "completed",
            progress: 100,
            completed_at: new Date().toISOString(),
            completed_tasks: JSON.stringify([
              "Review hasil kerja staff",
              "Validasi kelengkapan",
              "Tentukan tindak lanjut",
            ]),
          })
          .eq("report_id", reportId)
          .eq("staff_id", user.id)

        // Create final TU task for completion
        const { data: finalTask, error: finalError } = await supabase
          .from("task_assignments")
          .insert({
            report_id: reportId,
            staff_id: report.created_by, // TU who created the report
            coordinator_id: user.id,
            todo_list: JSON.stringify(["Terima hasil akhir", "Arsipkan dokumen", "Tutup laporan"]),
            completed_tasks: JSON.stringify(["Terima hasil akhir", "Arsipkan dokumen", "Tutup laporan"]),
            progress: 100,
            status: "completed",
            notes: notes || "Laporan selesai dikerjakan, dikembalikan ke TU",
            completed_at: new Date().toISOString(),
          })
          .select()
          .single()

        if (finalError) {
          return NextResponse.json({ error: "Failed to create final task" }, { status: 500 })
        }

        taskAssignment = finalTask
        workflowAction = "Selesai dikembalikan ke TU"
        newStatus = "completed"
        updateData = { current_holder: report.created_by, status: "completed", progress: 100 }
        break

      case "request_revision":
        // Special case: Coordinator requests revision from staff
        if (!["Koordinator", "Admin"].includes(profile.role)) {
          return NextResponse.json({ error: "Only coordinator can request revision" }, { status: 403 })
        }

        // Create revision task for staff
        const { data: revisionTask, error: revisionError } = await supabase
          .from("task_assignments")
          .insert({
            report_id: reportId,
            staff_id: staffId,
            coordinator_id: user.id,
            todo_list: JSON.stringify(
              todoList || ["Perbaiki sesuai catatan", "Lengkapi dokumen yang kurang", "Kirim ulang ke koordinator"],
            ),
            completed_tasks: JSON.stringify([]),
            progress: 0,
            status: "revision_required",
            notes: notes || "Perlu revisi sesuai catatan koordinator",
            revision_notes: notes,
          })
          .select()
          .single()

        if (revisionError) {
          return NextResponse.json({ error: "Failed to create revision task" }, { status: 500 })
        }

        taskAssignment = revisionTask
        workflowAction = "Dikembalikan ke staff untuk revisi"
        newStatus = "revision_required"
        updateData = { current_holder: staffId, status: "revision_required" }
        break

      default:
        return NextResponse.json({ error: "Invalid workflow step" }, { status: 400 })
    }

    // Update report status and current holder
    const { error: reportUpdateError } = await supabase.from("reports").update(updateData).eq("id", reportId)

    if (reportUpdateError) {
      console.error("Error updating report:", reportUpdateError)
    }

    // Create workflow history entry
    const { error: historyError } = await supabase.from("workflow_history").insert({
      report_id: reportId,
      action: workflowAction,
      user_id: user.id,
      status: newStatus,
      notes: notes || workflowAction,
    })

    if (historyError) {
      console.error("Error creating workflow history:", historyError)
    }

    return NextResponse.json({
      success: true,
      message: `${workflowAction} berhasil`,
      taskAssignment,
      newStatus,
    })
  } catch (error) {
    console.error("Task assignment algorithm error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
