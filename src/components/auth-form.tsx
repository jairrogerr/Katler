"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function AuthForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")

  const handleAuth = async (type: "login" | "signup") => {
    setLoading(true)
    setMessage("")
    const { error } = type === "login" 
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password })
    
    if (error) setMessage(error.message)
    else if (type === "signup") setMessage("Check your email for the confirmation link.")
    setLoading(false)
  }

  return (
    <Card className="w-full max-w-md border-none bg-zinc-900/50 backdrop-blur-xl">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold tracking-tight text-white">Katler</CardTitle>
        <CardDescription className="text-zinc-400">
          Minimalist communication for focused builders.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-2">
          <Input
            type="email"
            placeholder="email@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-zinc-800 border-zinc-700 text-white focus:ring-primary"
          />
        </div>
        <div className="grid gap-2">
          <Input
            type="password"
            placeholder="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-zinc-800 border-zinc-700 text-white focus:ring-primary"
          />
        </div>
        {message && <p className="text-sm text-zinc-400">{message}</p>}
        <div className="flex gap-2">
          <Button 
            className="flex-1 katler-gradient border-none hover:opacity-90 transition-opacity"
            onClick={() => handleAuth("login")}
            disabled={loading}
          >
            Sign In
          </Button>
          <Button 
            variant="outline" 
            className="flex-1 border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            onClick={() => handleAuth("signup")}
            disabled={loading}
          >
            Join
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
