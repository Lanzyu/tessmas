"use client"

import { useState } from "react"
import { X, User, LogOut } from "lucide-react"
import type { FileAttachment } from "../../types"
import { useApp } from "../../context/AppContext"

export function ReportForm({ report, onSubmit, onCancel }) {
  const { state } = useApp()
  const currentUser = state.currentUser

  const logout = () => {
    // Simple logout - clear localStorage and reload
    localStorage.removeItem("sitrack_app_state")
    window.location.reload()
  }

  const [formData, setFormData] = useState({
    title: report?.no_surat || "",
    description: report?.hal || "",
  })

  const [attachments, setAttachments] = useState<FileAttachment[]>(report?.originalFiles || [])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({})

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
          title: formData.title,
          description: formData.description,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to save report")
      }

      alert(`Laporan berhasil disimpan!\nID: ${result.report.id}`)
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

  const handleFileUpload = async (files: FileList) => {
    if (!files.length) return

    setUploading(true)
    const reportId = report?.id || `temp-${Date.now()}`

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const fileId = `${file.name}-${Date.now()}`

      try {
        setUploadProgress((prev) => ({ ...prev, [fileId]: 0 }))

        const formData = new FormData()
        formData.append("file", file)
        formData.append("reportId", reportId)
        formData.append("uploadedBy", currentUser?.name || "Unknown User")

        const response = await fetch("/api/upload", {
          method: "POST",
          credentials: "include",
          body: formData,
        })

        if (!response.ok) {
          throw new Error("Upload failed")
        }

        const fileAttachment: FileAttachment = await response.json()
        setAttachments((prev) => [...prev, fileAttachment])
        setUploadProgress((prev) => ({ ...prev, [fileId]: 100 }))
      } catch (error) {
        console.error("Error uploading file:", error)
        alert(`Gagal mengupload file ${file.name}`)
      }
    }

    setUploading(false)
    setUploadProgress({})
  }

  const handleRemoveFile = (fileId: string) => {
    setAttachments((prev) => prev.filter((file) => file.id !== fileId))
  }

  const handleDownloadFile = async (fileUrl: string, fileName: string) => {
    try {
      const response = await fetch(
        `/api/download?url=${encodeURIComponent(fileUrl)}&fileName=${encodeURIComponent(fileName)}`,
        {
          credentials: "include",
        },
      )

      if (!response.ok) {
        throw new Error("Download failed")
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error("Error downloading file:", error)
      alert("Gagal mengunduh file")
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">{report ? "Edit Laporan" : "Buat Laporan Baru"}</h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        {currentUser && (
          <div className="mx-6 mt-4 p-4 border border-blue-200 bg-blue-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-medium text-blue-900">
                    Sedang login sebagai: <span className="font-bold">{currentUser.name}</span>
                  </p>
                  <p className="text-sm text-blue-700">
                    Role: <span className="font-semibold">{currentUser.role}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={logout}
                className="flex items-center gap-2 px-3 py-1 text-sm border border-blue-300 text-blue-700 hover:bg-blue-100 bg-transparent rounded-md transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-6">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                Judul Laporan
              </label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Masukkan judul laporan"
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                Deskripsi
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                required
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Masukkan deskripsi laporan"
              />
            </div>
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
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {report ? "Update" : "Simpan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
