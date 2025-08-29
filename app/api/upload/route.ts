import { put } from "@vercel/blob"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    console.log("[v0] Uploading file:", file.name, "Size:", file.size)
    console.log("[v0] BLOB_READ_WRITE_TOKEN available:", !!process.env.BLOB_READ_WRITE_TOKEN)

    const uploadOptions: any = {
      access: "public",
      addRandomSuffix: true,
    }

    // Use hardcoded token if environment variable is not available
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      uploadOptions.token = "vercel_blob_rw_eIOoTS6AD9dYs0Xf_LOiiwC03vhm3e4MiGiUy2Xz5RmzxTZ"
      console.log("[v0] Using hardcoded token for Blob upload")
    }

    // Upload to Vercel Blob
    const blob = await put(file.name, file, uploadOptions)

    console.log("[v0] Upload successful:", blob.url)

    return NextResponse.json({
      url: blob.url,
      fileName: file.name,
      filename: file.name, // Keep both for compatibility
      size: file.size,
      type: file.type,
    })
  } catch (error) {
    console.error("[v0] Upload error:", error)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}
