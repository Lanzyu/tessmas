import { createServiceRoleClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    console.log("SERVICE ROLE KEY:", process.env.SUPABASE_SERVICE_ROLE_KEY ? "KEBACA ✅" : "KOSONG ❌")

    const { title, description } = await request.json()

    if (!title || !description) {
      return NextResponse.json({ error: "Title dan description wajib diisi" }, { status: 400 })
    }

    const supabase = await createServiceRoleClient()

    const { data: report, error } = await supabase
      .from("reports")
      .insert({
        no_surat: title,
        hal: description,
        progress: "dalam proses", // Set default progress as requested
        layanan: "Umum",
        dari: "System",
        tanggal_surat: new Date().toISOString().split("T")[0],
        tanggal_agenda: new Date().toISOString().split("T")[0],
        status: "draft",
        priority: "sedang",
        sifat: [],
        derajat: [],
        created_by: "00000000-0000-0000-0000-000000000000", // System user
        current_holder: "00000000-0000-0000-0000-000000000000",
      })
      .select()
      .single()

    if (error) {
      console.error("Database error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      report,
      message: "Laporan berhasil disimpan",
    })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
