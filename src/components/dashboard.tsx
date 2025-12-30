"use client"

import { useState, useEffect, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Plus, Hash, Send, Filter, LogOut, CheckCircle2, Lightbulb, AlertCircle } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

type Project = { id: string; name: string; description: string }
type Message = { id: string; content: string; tag: string; user_id: string; created_at: string }

export function Dashboard({ user }: { user: any }) {
  const [projects, setProjects] = useState<Project[]>([])
  const [activeProject, setActiveProject] = useState<Project | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [activeTag, setActiveTag] = useState<string>("none")
  const [filter, setFilter] = useState<string | null>(null)
  const [showNewProject, setShowNewProject] = useState(false)
  const [projectName, setProjectName] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchProjects()
    const subscription = supabase
      .channel("messages")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        if (activeProject && payload.new.project_id === activeProject.id) {
          setMessages((prev) => [...prev, payload.new as Message])
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(subscription) }
  }, [activeProject])

  useEffect(() => {
    if (activeProject) fetchMessages()
  }, [activeProject, filter])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTo(0, scrollRef.current.scrollHeight)
  }, [messages])

  const fetchProjects = async () => {
    const { data } = await supabase.from("projects").select("*").order("created_at", { ascending: false })
    if (data) setProjects(data)
  }

  const fetchMessages = async () => {
    let query = supabase.from("messages").select("*").eq("project_id", activeProject?.id).order("created_at", { ascending: true })
    if (filter) query = query.eq("tag", filter)
    const { data } = await query
    if (data) setMessages(data)
  }

  const createProject = async () => {
    if (!projectName) return
    const { data } = await supabase.from("projects").insert({ name: projectName, created_by: user.id }).select().single()
    if (data) {
      setProjects([data, ...projects])
      setProjectName("")
      setShowNewProject(false)
      setActiveProject(data)
    }
  }

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !activeProject) return
    await supabase.from("messages").insert({
      content: newMessage,
      project_id: activeProject.id,
      user_id: user.id,
      tag: activeTag
    })
    setNewMessage("")
    setActiveTag("none")
  }

  const logout = () => supabase.auth.signOut()

  return (
    <div className="flex h-screen bg-black text-zinc-100 overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 border-r border-zinc-800 flex flex-col bg-zinc-950/50">
        <div className="p-4 flex items-center justify-between border-b border-zinc-800">
          <h2 className="text-xl font-bold katler-gradient-text">Katler</h2>
          <Button variant="ghost" size="icon" onClick={() => setShowNewProject(true)} className="text-zinc-400">
            <Plus className="w-5 h-5" />
          </Button>
        </div>
        
        <ScrollArea className="flex-1 p-2">
          {showNewProject && (
            <div className="p-2 mb-2 bg-zinc-900 rounded-lg space-y-2">
              <Input 
                placeholder="Project name..." 
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="h-8 text-sm bg-black border-zinc-700"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={createProject} className="h-7 text-xs flex-1">Create</Button>
                <Button size="sm" variant="ghost" onClick={() => setShowNewProject(false)} className="h-7 text-xs flex-1">Cancel</Button>
              </div>
            </div>
          )}
          <div className="space-y-1">
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => setActiveProject(p)}
                className={`w-full flex items-center gap-2 p-2 rounded-md text-sm transition-colors ${
                  activeProject?.id === p.id ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                }`}
              >
                <Hash className="w-4 h-4" />
                {p.name}
              </button>
            ))}
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-zinc-800 flex items-center justify-between bg-zinc-950">
          <div className="flex items-center gap-2 truncate">
            <div className="w-8 h-8 rounded-full katler-gradient flex items-center justify-center text-xs font-bold">
              {user.email?.[0].toUpperCase()}
            </div>
            <span className="text-xs truncate text-zinc-400">{user.email}</span>
          </div>
          <Button variant="ghost" size="icon" onClick={logout} className="text-zinc-500 hover:text-red-400">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative">
        {!activeProject ? (
          <div className="flex-1 flex items-center justify-center text-zinc-500">
            Select a project to start focused communication.
          </div>
        ) : (
          <>
            <div className="h-16 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-950/50 backdrop-blur-sm z-10">
              <div>
                <h3 className="font-medium text-zinc-200">{activeProject.name}</h3>
                <p className="text-xs text-zinc-500">{activeProject.description || "No description"}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant={filter === null ? "secondary" : "ghost"} 
                  size="sm" 
                  onClick={() => setFilter(null)}
                  className="h-8 text-xs"
                >All</Button>
                <Button 
                  variant={filter === "decision" ? "secondary" : "ghost"} 
                  size="sm" 
                  onClick={() => setFilter("decision")}
                  className="h-8 text-xs text-emerald-400"
                >Decisions</Button>
                <Button 
                  variant={filter === "idea" ? "secondary" : "ghost"} 
                  size="sm" 
                  onClick={() => setFilter("idea")}
                  className="h-8 text-xs text-amber-400"
                >Ideas</Button>
                <Button 
                  variant={filter === "problem" ? "secondary" : "ghost"} 
                  size="sm" 
                  onClick={() => setFilter("problem")}
                  className="h-8 text-xs text-rose-400"
                >Problems</Button>
              </div>
            </div>

            <ScrollArea className="flex-1 p-6" viewportRef={scrollRef}>
              <div className="max-w-3xl mx-auto space-y-6 pb-4">
                {messages.map((m) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    key={m.id} 
                    className="flex flex-col group"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-medium text-zinc-600 uppercase tracking-widest">
                        {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {m.tag !== 'none' && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-bold tracking-tighter ${
                          m.tag === 'decision' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                          m.tag === 'idea' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                          'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                        }`}>
                          {m.tag}
                        </span>
                      )}
                    </div>
                    <p className={`text-sm leading-relaxed ${
                      m.tag === 'decision' ? 'text-emerald-50 /90 font-medium' : 
                      m.tag === 'idea' ? 'text-amber-50/90' : 
                      m.tag === 'problem' ? 'text-rose-50/90' : 
                      'text-zinc-300'
                    }`}>
                      {m.content}
                    </p>
                  </motion.div>
                ))}
              </div>
            </ScrollArea>

            <div className="p-6 border-t border-zinc-800 bg-zinc-950/50">
              <form onSubmit={sendMessage} className="max-w-3xl mx-auto space-y-4">
                <div className="flex items-center gap-4 text-xs text-zinc-500 px-1">
                  <button 
                    type="button"
                    onClick={() => setActiveTag(activeTag === 'decision' ? 'none' : 'decision')}
                    className={`flex items-center gap-1.5 transition-colors ${activeTag === 'decision' ? 'text-emerald-400 font-bold' : 'hover:text-zinc-300'}`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Decision
                  </button>
                  <button 
                    type="button"
                    onClick={() => setActiveTag(activeTag === 'idea' ? 'none' : 'idea')}
                    className={`flex items-center gap-1.5 transition-colors ${activeTag === 'idea' ? 'text-amber-400 font-bold' : 'hover:text-zinc-300'}`}
                  >
                    <Lightbulb className="w-3.5 h-3.5" /> Idea
                  </button>
                  <button 
                    type="button"
                    onClick={() => setActiveTag(activeTag === 'problem' ? 'none' : 'problem')}
                    className={`flex items-center gap-1.5 transition-colors ${activeTag === 'problem' ? 'text-rose-400 font-bold' : 'hover:text-zinc-300'}`}
                  >
                    <AlertCircle className="w-3.5 h-3.5" /> Problem
                  </button>
                </div>
                <div className="flex gap-2">
                  <Input 
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message or record a decision..."
                    className="flex-1 bg-zinc-900 border-zinc-800 focus:ring-primary h-11"
                  />
                  <Button type="submit" size="icon" className="h-11 w-11 katler-gradient shrink-0">
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
