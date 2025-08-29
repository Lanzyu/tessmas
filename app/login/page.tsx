"use client"
import { useEffect, useState } from "react"

export default function Login() {
  const [time, setTime] = useState<string>("")
  const [email, setEmail] = useState("")

  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setTime(
        now.toLocaleString("id-ID", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      )
    }

    updateTime() // set waktu awal
    const interval = setInterval(updateTime, 1000) // update tiap detik

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 p-4 bg-white rounded-lg border border-gray-200">
          <p className="text-sm text-gray-500 mb-1">Waktu Server:</p>
          <p className="text-lg font-semibold text-gray-900">{time}</p>
        </div>

        {/* rest of code here */}
      </div>
    </div>
  )
}
