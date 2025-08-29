"use client"

import { useState, useEffect } from "react"
import { X, Upload } from "lucide-react"
import type { FileAttachment } from "../../types"
import { useApp } from "../../context/AppContext"
import { SERVICES } from "../../types"

export function ReportForm({ report, onSubmit, onCancel }) {
  const { state } = useApp()
  const currentUser = state.currentUser

  const [formData, setFormData] = useState({
    layanan: report?.layanan || "",
    noAgenda: report?.no_agenda || "",
    kelompokAsalSurat: report?.kelompok_asal_surat || "",
    agendaSestama: report?.agenda_sestama || "",
    noSurat: report?.no_surat || "",
    hal: report?.hal || "",
    dari: report?.dari || "",
    tanggalAgenda: report?.tanggal_agenda || "",
    tanggalSurat: report?.tanggal_surat || "",
    sifat: report?.sifat || [],
    derajat: report?.derajat || [],
  })

  const [attachments, setAttachments] = useState<FileAttachment[]>(report?.originalFiles || [])
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)

  const [reportProgress, setReportProgress] = useState(report?.progress || 0)

  useEffect(() => {
    if (report?.id) {
      // Set up real-time subscription for report progress updates
      const interval = setInterval(async () => {
        try {
          const response = await fetch(`/api/reports/${report.id}`)
          if (response.ok) {
            const data = await response.json()
            if (data.report?.progress !== reportProgress) {
              setReportProgress(data.report.progress)
            }
          }
        } catch (error) {
          console.error("Error fetching report progress:", error)
        }
      }, 2000) // Poll every 2 seconds

      return () => clearInterval(interval)
    }
  }, [report?.id, reportProgress])

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (
      !currentUser ||
      (currentUser.role !== "TU" && currentUser.role !== "Admin" && currentUser.role !== "Coordinator")
    ) {
      alert("Hanya TU, Admin, dan Coordinator yang dapat membuat laporan baru")
      return
    }

    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          originalFiles: attachments,
          status: "draft",
          priority: "sedang",
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        const errorMessage = result.details || result.error || "Failed to save report"
        throw new Error(errorMessage)
      }

      alert(`Laporan berhasil disimpan!\nID: ${result.report.id}`)

      setReportProgress(0)
      setTimeout(() => setReportProgress(25), 1000) // Simulate progress update

      onSubmit(result.report)
    } catch (error) {
      console.error("Error saving report:", error)
      alert(`Gagal menyimpan laporan: ${error.message}`)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({
      ...formData,
      [name]: value,
    })
  }

  const handleCheckboxChange = (e, field) => {
    const { value, checked } = e.target
    setFormData((prev) => ({
      ...prev,
      [field]: checked ? [...prev[field], value] : prev[field].filter((item) => item !== value),
    }))
  }

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files)
    }
  }

  const handleFileUpload = async (files: FileList) => {
    if (!files.length) return

    setUploading(true)
    const reportId = report?.id || `temp-${Date.now()}`

    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      try {
        const formData = new FormData()
        formData.append("file", file)
        formData.append("reportId", reportId)
        formData.append("uploadedBy", currentUser?.name || "Unknown User")

        console.log("[v0] Uploading file:", file.name)

        const response = await fetch("/api/upload", {
          method: "POST",
          credentials: "include",
          body: formData,
        })

        const contentType = response.headers.get("content-type")
        console.log("[v0] Response content type:", contentType)
        console.log("[v0] Response status:", response.status)

        if (!response.ok) {
          let errorData
          try {
            if (contentType && contentType.includes("application/json")) {
              errorData = await response.json()
            } else {
              const errorText = await response.text()
              console.error("[v0] Non-JSON error response:", errorText)
              errorData = {
                error: "Server error",
                details: "Server returned non-JSON response",
                suggestion: "Check if BLOB_READ_WRITE_TOKEN is configured in Project Settings",
              }
            }
          } catch (parseError) {
            console.error("[v0] Error parsing response:", parseError)
            errorData = {
              error: "Response parsing error",
              details: "Could not parse server response",
              suggestion: "Check server logs for details",
            }
          }

          console.error("[v0] Upload response error:", errorData)
          const errorMessage = errorData.details || errorData.error || "Upload failed"
          throw new Error(errorMessage)
        }

        let uploadResponse: any
        try {
          if (contentType && contentType.includes("application/json")) {
            uploadResponse = await response.json()
          } else {
            throw new Error("Server returned non-JSON response for successful upload")
          }
        } catch (parseError) {
          console.error("[v0] Error parsing success response:", parseError)
          throw new Error("Could not parse upload response")
        }

        const fileAttachment: FileAttachment = {
          fileName: uploadResponse.fileName || uploadResponse.filename || file.name,
          url: uploadResponse.url,
          size: uploadResponse.size || file.size,
          type: uploadResponse.type || file.type,
          uploadedBy: currentUser?.name || "Unknown User",
          uploadedAt: new Date().toISOString(),
        }

        console.log("[v0] File uploaded successfully:", fileAttachment.fileName)
        console.log("[v0] Full upload response:", uploadResponse)
        setAttachments((prev) => [...prev, fileAttachment])
      } catch (error) {
        console.error("[v0] Error uploading file:", error)
        const errorMessage = error instanceof Error ? error.message : "Unknown error"
        alert(`Error uploading file ${file.name}: ${errorMessage}`)
      }
    }

    setUploading(false)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">{report ? "Edit Laporan" : "Buat Laporan Baru"}</h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-6">
            <div>
              <label htmlFor="layanan" className="block text-sm font-medium text-gray-700 mb-2">
                Layanan
              </label>
              <select
                id="layanan"
                name="layanan"
                value={formData.layanan}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Pilih Layanan</option>
                {SERVICES.map((service) => (
                  <option key={service} value={service}>
                    {service}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="noAgenda" className="block text-sm font-medium text-gray-700 mb-2">
                  No. Agenda
                </label>
                <input
                  type="text"
                  id="noAgenda"
                  name="noAgenda"
                  value={formData.noAgenda}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label htmlFor="kelompokAsalSurat" className="block text-sm font-medium text-gray-700 mb-2">
                  Kelompok Asal Surat
                </label>
                <input
                  type="text"
                  id="kelompokAsalSurat"
                  name="kelompokAsalSurat"
                  value={formData.kelompokAsalSurat}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="agendaSestama" className="block text-sm font-medium text-gray-700 mb-2">
                  Agenda Sestama
                </label>
                <input
                  type="text"
                  id="agendaSestama"
                  name="agendaSestama"
                  value={formData.agendaSestama}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label htmlFor="noSurat" className="block text-sm font-medium text-gray-700 mb-2">
                  No. Surat
                </label>
                <input
                  type="text"
                  id="noSurat"
                  name="noSurat"
                  value={formData.noSurat}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="hal" className="block text-sm font-medium text-gray-700 mb-2">
                  Hal
                </label>
                <input
                  type="text"
                  id="hal"
                  name="hal"
                  value={formData.hal}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label htmlFor="dari" className="block text-sm font-medium text-gray-700 mb-2">
                  Dari
                </label>
                <input
                  type="text"
                  id="dari"
                  name="dari"
                  value={formData.dari}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Sifat</label>
                <div className="space-y-2">
                  {["Biasa", "Penting", "Rahasia"].map((sifat) => (
                    <label key={sifat} className="flex items-center">
                      <input
                        type="checkbox"
                        value={sifat}
                        checked={formData.sifat.includes(sifat)}
                        onChange={(e) => handleCheckboxChange(e, "sifat")}
                        className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="text-sm text-gray-700">{sifat}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Derajat</label>
                <div className="space-y-2">
                  {["Biasa", "Segera", "Kilat"].map((derajat) => (
                    <label key={derajat} className="flex items-center">
                      <input
                        type="checkbox"
                        value={derajat}
                        checked={formData.derajat.includes(derajat)}
                        onChange={(e) => handleCheckboxChange(e, "derajat")}
                        className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="text-sm text-gray-700">{derajat}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Unggah Berkas</label>
              <div
                className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  dragActive ? "border-blue-400 bg-blue-50" : "border-gray-300 hover:border-gray-400"
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                {attachments.length === 0 ? (
                  <>
                    <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <p className="text-gray-600 mb-2">Klik untuk upload atau drag and drop</p>
                    <p className="text-sm text-gray-500">PDF, DOCX, JPG, PNG (MAX. 10MB)</p>
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.docx,.jpg,.jpeg,.png"
                      onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                      className="hidden"
                      id="file-upload"
                    />
                    <label
                      htmlFor="file-upload"
                      className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors"
                    >
                      Pilih File
                    </label>
                  </>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-center mb-4">
                      <Upload className="h-8 w-8 text-green-500 mr-2" />
                      <span className="text-green-600 font-medium">{attachments.length} file berhasil diupload</span>
                    </div>

                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {attachments.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg"
                        >
                          <div className="flex items-center">
                            <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                            <span className="text-sm font-medium text-green-800">{file.fileName}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== index))}
                            className="text-red-500 hover:text-red-700 text-sm font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors"
                          >
                            Hapus
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2 border-t border-gray-200">
                      <input
                        type="file"
                        multiple
                        accept=".pdf,.docx,.jpg,.jpeg,.png"
                        onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                        className="hidden"
                        id="file-upload-more"
                      />
                      <label
                        htmlFor="file-upload-more"
                        className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors text-sm"
                      >
                        Tambah File Lain
                      </label>
                    </div>
                  </div>
                )}

                {uploading && (
                  <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center rounded-lg">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                      <p className="text-sm text-gray-600">Mengupload file...</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {reportProgress > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-green-800">Status Progress</span>
                  <span className="text-sm text-green-600">{reportProgress}%</span>
                </div>
                <div className="w-full bg-green-200 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${reportProgress}%` }}
                  ></div>
                </div>
                <p className="text-sm text-green-700 mt-2">Dalam Proses</p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-8">
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={uploading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {uploading ? "Mengupload..." : report ? "Update" : "Simpan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
