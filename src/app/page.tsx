"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { AuthForm } from "@/components/auth-form"
import { Dashboard } from "@/components/dashboard"
import { Loader2 } from "lucide-react"

export default function Home() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-black">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }

  return (
    <main className="h-screen w-screen bg-black">
      {!session ? (
        <div className="h-full w-full flex items-center justify-center p-4">
          <AuthForm />
        </div>
      ) : (
        <Dashboard user={session.user} />
      )}
    </main>
  )
}
