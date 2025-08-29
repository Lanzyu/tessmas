export interface WorkflowStep {
  step: string
  allowedRoles: string[]
  nextStep?: string
  description: string
}

export const WORKFLOW_STEPS: Record<string, WorkflowStep> = {
  tu_to_coordinator: {
    step: "tu_to_coordinator",
    allowedRoles: ["TU", "Admin"],
    nextStep: "coordinator_to_staff",
    description: "TU meneruskan laporan ke koordinator untuk review",
  },
  coordinator_to_staff: {
    step: "coordinator_to_staff",
    allowedRoles: ["Koordinator", "Admin"],
    nextStep: "staff_to_coordinator",
    description: "Koordinator menugaskan ke staff untuk dikerjakan",
  },
  staff_to_coordinator: {
    step: "staff_to_coordinator",
    allowedRoles: ["Staff"],
    nextStep: "coordinator_to_tu",
    description: "Staff mengembalikan hasil kerja ke koordinator",
  },
  coordinator_to_tu: {
    step: "coordinator_to_tu",
    allowedRoles: ["Koordinator", "Admin"],
    nextStep: null,
    description: "Koordinator menyelesaikan dan mengembalikan ke TU",
  },
  request_revision: {
    step: "request_revision",
    allowedRoles: ["Koordinator", "Admin"],
    nextStep: "staff_to_coordinator",
    description: "Koordinator meminta revisi dari staff",
  },
}

export function getNextWorkflowStep(currentStatus: string, userRole: string): string[] {
  const availableSteps: string[] = []

  switch (currentStatus) {
    case "draft":
      if (["TU", "Admin"].includes(userRole)) {
        availableSteps.push("tu_to_coordinator")
      }
      break
    case "pending_coordinator_review":
      if (["Koordinator", "Admin"].includes(userRole)) {
        availableSteps.push("coordinator_to_staff", "coordinator_to_tu")
      }
      break
    case "in_progress":
      if (userRole === "Staff") {
        availableSteps.push("staff_to_coordinator")
      }
      if (["Koordinator", "Admin"].includes(userRole)) {
        availableSteps.push("request_revision")
      }
      break
    case "revision_required":
      if (userRole === "Staff") {
        availableSteps.push("staff_to_coordinator")
      }
      break
  }

  return availableSteps
}

export function calculateTaskProgress(todoList: string[], completedTasks: string[]): number {
  if (!todoList || todoList.length === 0) return 0
  if (!completedTasks) return 0

  const progress = (completedTasks.length / todoList.length) * 100
  return Math.min(Math.max(progress, 0), 100)
}

export function getDefaultTodoList(workflowStep: string, reportType?: string): string[] {
  const baseTodos: Record<string, string[]> = {
    tu_to_coordinator: [
      "Review kelengkapan dokumen",
      "Tentukan prioritas penanganan",
      "Pilih staff yang akan mengerjakan",
      "Buat rencana kerja",
    ],
    coordinator_to_staff: [
      "Pelajari dokumen dan instruksi",
      "Kerjakan tugas sesuai SOP",
      "Siapkan laporan hasil",
      "Koordinasi jika ada kendala",
    ],
    staff_to_coordinator: [
      "Review hasil kerja staff",
      "Validasi kelengkapan dokumen",
      "Periksa kesesuaian dengan SOP",
      "Tentukan tindak lanjut",
    ],
    coordinator_to_tu: ["Terima hasil akhir", "Verifikasi kelengkapan", "Arsipkan dokumen", "Tutup laporan"],
    request_revision: [
      "Perbaiki sesuai catatan",
      "Lengkapi dokumen yang kurang",
      "Konsultasi jika perlu",
      "Kirim ulang ke koordinator",
    ],
  }

  return baseTodos[workflowStep] || []
}
