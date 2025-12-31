"use client"

import { useState, useEffect, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Plus, Hash, Send, LogOut, CheckCircle2, Lightbulb, AlertCircle, Settings, User, Users, Mail, Check, X, Info } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog"

type Project = { id: string; name: string; description: string; owner_id: string }
type Profile = { id: string; username: string; avatar_url: string }
type Message = { id: string; content: string; tag: string; user_id: string; created_at: string; profiles?: { username: string } }
type Invite = { id: string; project_id: string; projects: { name: string }; status: string }

export function Dashboard({ user }: { user: any }) {
  const [projects, setProjects] = useState<Project[]>([])
  const [activeProject, setActiveProject] = useState<Project | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [activeTag, setActiveTag] = useState<string>("none")
  const [filter, setFilter] = useState<string | null>(null)
  const [showNewProject, setShowNewProject] = useState(false)
  const [projectName, setProjectName] = useState("")
  const [projectDescription, setProjectDescription] = useState("")
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const [newUsername, setNewUsername] = useState("")
  const [isUsernameEnforced, setIsUsernameEnforced] = useState(false)
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false)
  const [inviteIdentifier, setInviteIdentifier] = useState("")
  const [pendingInvites, setPendingInvites] = useState<Invite[]>([])
  const [projectMembers, setProjectMembers] = useState<any[]>([])
  const [entryLogs, setEntryLogs] = useState<any[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)

  const isOwner = activeProject?.owner_id === user.id

  useEffect(() => {
    fetchInitialData()
    
    const messagesSubscription = supabase
      .channel("messages")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, async (payload) => {
        if (activeProject && payload.new.project_id === activeProject.id) {
          const { data: profileData } = await supabase.from("profiles").select("username").eq("id", payload.new.user_id).single()
          const messageWithProfile = { ...payload.new, profiles: profileData } as Message
          setMessages((prev) => [...prev, messageWithProfile])
        }
      })
      .subscribe()

    const invitesSubscription = supabase
      .channel("invites")
      .on("postgres_changes", { event: "*", schema: "public", table: "project_invites" }, () => {
        fetchInvites()
      })
      .subscribe()

    return () => { 
      supabase.removeChannel(messagesSubscription)
      supabase.removeChannel(invitesSubscription)
    }
  }, [activeProject])

  useEffect(() => {
    if (activeProject) {
      fetchMessages()
      logEntry()
      if (isOwner) {
        fetchProjectMembers()
        fetchEntryLogs()
      }
    }
  }, [activeProject, filter])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTo(0, scrollRef.current.scrollHeight)
  }, [messages])

  const fetchInitialData = async () => {
    await fetchProfile()
    await fetchProjects()
    await fetchInvites()
  }

  const fetchProfile = async () => {
    const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).single()
    if (error && error.code === "PGRST116") {
      // Profile doesn't exist, create it
      const { data: newProfile } = await supabase.from("profiles").insert({ id: user.id }).select().single()
      if (newProfile) {
        setProfile(newProfile)
        if (!newProfile.username) setIsUsernameEnforced(true)
      }
    } else if (data) {
      setProfile(data)
      setNewUsername(data.username || "")
      if (!data.username) setIsUsernameEnforced(true)
    }
  }

  const updateProfile = async () => {
    if (!newUsername.trim()) return
    const { data, error } = await supabase
      .from("profiles")
      .update({ username: newUsername, updated_at: new Date().toISOString() })
      .eq("id", user.id)
      .select()
      .single()
    
    if (error) {
      alert("Username already taken or invalid.")
      return
    }
    if (data) {
      setProfile(data)
      setIsProfileModalOpen(false)
      setIsUsernameEnforced(false)
    }
  }

  const fetchProjects = async () => {
    const { data } = await supabase.from("projects").select("*").order("created_at", { ascending: false })
    if (data) setProjects(data)
  }

  const fetchInvites = async () => {
    const { data } = await supabase
      .from("project_invites")
      .select("*, projects(name)")
      .eq("status", "pending")
      .or(`invitee_user_id.eq.${user.id},invitee_email.eq.${user.email}`)
    if (data) setPendingInvites(data as any)
  }

  const fetchMessages = async () => {
    let query = supabase
      .from("messages")
      .select("*, profiles:user_id(username)")
      .eq("project_id", activeProject?.id)
      .order("created_at", { ascending: true })
    
    if (filter) query = query.eq("tag", filter)
    const { data } = await query
    if (data) setMessages(data as Message[])
  }

    const createProject = async () => {
      if (!projectName) return
      const { data, error } = await supabase.from("projects").insert({ 
        name: projectName, 
        description: projectDescription,
        owner_id: user.id 
      }).select().single()
      
      if (error) {
        console.error("Error creating project:", error)
        return
      }
      if (data) {
        // Automatically add owner to project_members
        await supabase.from("project_members").insert({
          project_id: data.id,
          user_id: user.id,
          role: "owner"
        })
        
        setProjects([data, ...projects])
        setProjectName("")
        setProjectDescription("")
        setShowNewProject(false)
        setActiveProject(data)
      }
    }

  const updateProject = async () => {
    if (!activeProject || !projectName) return
    const { data, error } = await supabase
      .from("projects")
      .update({ name: projectName, description: projectDescription })
      .eq("id", activeProject.id)
      .select()
      .single()
    
    if (error) return
    setProjects(projects.map(p => p.id === data.id ? data : p))
    setActiveProject(data)
    setIsSettingsModalOpen(false)
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

  const logEntry = async () => {
    if (!activeProject) return
    await supabase.from("project_entry_logs").insert({
      project_id: activeProject.id,
      user_id: user.id
    })
  }

  const fetchEntryLogs = async () => {
    if (!activeProject || !isOwner) return
    const { data } = await supabase
      .from("project_entry_logs")
      .select("*, profiles:user_id(username)")
      .eq("project_id", activeProject.id)
      .order("entered_at", { ascending: false })
      .limit(20)
    if (data) setEntryLogs(data)
  }

  const fetchProjectMembers = async () => {
    if (!activeProject) return
    const { data } = await supabase
      .from("project_members")
      .select("*, profiles:user_id(username)")
      .eq("project_id", activeProject.id)
    if (data) setProjectMembers(data)
  }

  const inviteUser = async () => {
    if (!activeProject || !inviteIdentifier) return
    
    let invitee_user_id = null
    let invitee_email = null

    if (inviteIdentifier.includes("@")) {
      invitee_email = inviteIdentifier
    } else {
      const { data: profileData } = await supabase.from("profiles").select("id").eq("username", inviteIdentifier.replace("@", "")).single()
      if (profileData) invitee_user_id = profileData.id
      else {
        alert("User not found")
        return
      }
    }

    const { error } = await supabase.from("project_invites").insert({
      project_id: activeProject.id,
      inviter_id: user.id,
      invitee_user_id,
      invitee_email,
      status: "pending",
      token: Math.random().toString(36).substring(2)
    })

    if (error) alert("Error sending invite")
    else {
      alert("Invite sent")
      setInviteIdentifier("")
    }
  }

  const respondToInvite = async (inviteId: string, status: "accepted" | "declined") => {
    const { data: invite } = await supabase.from("project_invites").update({ status }).eq("id", inviteId).select().single()
    if (status === "accepted" && invite) {
      await supabase.from("project_members").insert({
        project_id: invite.project_id,
        user_id: user.id,
        role: "member"
      })
      fetchProjects()
    }
    fetchInvites()
  }

  const logout = () => supabase.auth.signOut()

  return (
    <div className="flex h-screen bg-black text-zinc-100 overflow-hidden">
      {/* Username Enforcement Modal */}
      <Dialog open={isUsernameEnforced} onOpenChange={() => {}}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Welcome to Katler</DialogTitle>
            <DialogDescription>Please choose a unique username to continue.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input 
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="username"
              className="bg-black border-zinc-700"
            />
          </div>
          <DialogFooter>
            <Button onClick={updateProfile} className="katler-gradient w-full">Set Username</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sidebar */}
      <div className="w-64 border-r border-zinc-800 flex flex-col bg-zinc-950/50">
        <div className="p-4 flex items-center justify-between border-b border-zinc-800">
          <h2 className="text-xl font-bold katler-gradient-text">Katler</h2>
          <Button variant="ghost" size="icon" onClick={() => setShowNewProject(true)} className="text-zinc-400">
            <Plus className="w-5 h-5" />
          </Button>
        </div>
        
        <ScrollArea className="flex-1 p-2">
          {pendingInvites.length > 0 && (
            <div className="mb-4 p-2 space-y-2">
              <p className="text-[10px] font-bold text-zinc-500 uppercase px-2">Pending Invites</p>
              {pendingInvites.map(invite => (
                <div key={invite.id} className="p-2 bg-zinc-900/50 rounded-md border border-zinc-800 text-xs">
                  <p className="mb-2">Join <span className="text-white font-medium">{invite.projects.name}</span>?</p>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => respondToInvite(invite.id, "accepted")} className="h-6 text-[10px] flex-1 katler-gradient"><Check className="w-3 h-3 mr-1" /> Join</Button>
                    <Button size="sm" variant="ghost" onClick={() => respondToInvite(invite.id, "declined")} className="h-6 text-[10px] flex-1 text-zinc-500 hover:text-rose-400"><X className="w-3 h-3" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {showNewProject && (
            <div className="p-2 mb-2 bg-zinc-900 rounded-lg space-y-2 border border-zinc-800">
              <Input 
                placeholder="Project name..." 
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="h-8 text-sm bg-black border-zinc-700"
              />
              <Input 
                placeholder="Description (optional)" 
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                className="h-8 text-sm bg-black border-zinc-700"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={createProject} className="h-7 text-xs flex-1 katler-gradient">Create</Button>
                <Button size="sm" variant="ghost" onClick={() => setShowNewProject(false)} className="h-7 text-xs flex-1">Cancel</Button>
              </div>
            </div>
          )}
          
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-zinc-500 uppercase px-2 mb-2">Projects</p>
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setActiveProject(p)
                  setProjectName(p.name)
                  setProjectDescription(p.description || "")
                }}
                className={`w-full flex items-center gap-2 p-2 rounded-md text-sm transition-colors ${
                  activeProject?.id === p.id ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                }`}
              >
                <Hash className="w-4 h-4 shrink-0" />
                <span className="truncate">{p.name}</span>
              </button>
            ))}
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-zinc-800 flex flex-col gap-2 bg-zinc-950">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 truncate">
              <div className="w-8 h-8 rounded-full katler-gradient flex items-center justify-center text-xs font-bold shrink-0">
                {profile?.username?.[0]?.toUpperCase() || user.email?.[0].toUpperCase()}
              </div>
              <div className="flex flex-col truncate">
                <span className="text-xs font-medium text-zinc-200 truncate">@{profile?.username || "user"}</span>
                <span className="text-[10px] text-zinc-500 truncate">{user.email}</span>
              </div>
            </div>
            <div className="flex gap-1">
              <Dialog open={isProfileModalOpen} onOpenChange={setIsProfileModalOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="w-8 h-8 text-zinc-500 hover:text-zinc-200">
                    <Settings className="w-4 h-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
                  <DialogHeader>
                    <DialogTitle>Profile Settings</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <label className="text-sm text-zinc-400">Username</label>
                      <Input 
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        placeholder="Enter username"
                        className="bg-black border-zinc-700"
                      />
                      <p className="text-[10px] text-zinc-500 italic">This will be your public identifier.</p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={updateProfile} className="katler-gradient">Save Changes</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Button variant="ghost" size="icon" onClick={logout} className="w-8 h-8 text-zinc-500 hover:text-red-400">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative">
        {!activeProject ? (
          <div className="flex-1 flex items-center justify-center text-zinc-500 p-8 text-center max-w-md mx-auto">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-full border border-zinc-800 flex items-center justify-center mx-auto text-zinc-700">
                <Hash className="w-6 h-6" />
              </div>
              <p>Select or create a project to start focused communication and record decisions.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="h-16 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-950/50 backdrop-blur-sm z-10">
              <div className="truncate flex-1">
                <h3 className="font-medium text-zinc-200 truncate">{activeProject.name}</h3>
                <p className="text-[10px] text-zinc-500 truncate">{activeProject.description || "No description"}</p>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <div className="flex items-center gap-1 bg-zinc-900 rounded-lg p-1 border border-zinc-800">
                  <Button 
                    variant={filter === null ? "secondary" : "ghost"} 
                    size="sm" 
                    onClick={() => setFilter(null)}
                    className="h-7 text-[10px] px-2"
                  >All</Button>
                  <Button 
                    variant={filter === "decision" ? "secondary" : "ghost"} 
                    size="sm" 
                    onClick={() => setFilter("decision")}
                    className="h-7 text-[10px] px-2 text-emerald-400 hover:text-emerald-300"
                  >Decisions</Button>
                  <Button 
                    variant={filter === "idea" ? "secondary" : "ghost"} 
                    size="sm" 
                    onClick={() => setFilter("idea")}
                    className="h-7 text-[10px] px-2 text-amber-400 hover:text-amber-300"
                  >Ideas</Button>
                  <Button 
                    variant={filter === "problem" ? "secondary" : "ghost"} 
                    size="sm" 
                    onClick={() => setFilter("problem")}
                    className="h-7 text-[10px] px-2 text-rose-400 hover:text-rose-300"
                  >Problems</Button>
                </div>

                {isOwner && (
                  <div className="flex gap-1 border-l border-zinc-800 pl-4">
                    <Dialog open={isMembersModalOpen} onOpenChange={setIsMembersModalOpen}>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="w-8 h-8 text-zinc-500 hover:text-zinc-200">
                          <Users className="w-4 h-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100 max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Project Members</DialogTitle>
                          <DialogDescription>Manage who has access to this project.</DialogDescription>
                        </DialogHeader>
                        
                        <div className="grid grid-cols-2 gap-6 py-4">
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-zinc-500 uppercase">Invite Member</label>
                              <div className="flex gap-2">
                                <Input 
                                  value={inviteIdentifier}
                                  onChange={(e) => setInviteIdentifier(e.target.value)}
                                  placeholder="username or email"
                                  className="bg-black border-zinc-700 text-sm"
                                />
                                <Button onClick={inviteUser} className="katler-gradient shrink-0"><Plus className="w-4 h-4" /></Button>
                              </div>
                            </div>
                            
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-zinc-500 uppercase">Active Members</label>
                              <ScrollArea className="h-[200px] border border-zinc-800 rounded-md p-2 bg-black/50">
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between p-2 rounded bg-zinc-800/50">
                                    <span className="text-sm">@{profile?.username} (You)</span>
                                    <span className="text-[10px] bg-zinc-700 px-1.5 rounded uppercase font-bold text-zinc-400">Owner</span>
                                  </div>
                                  {projectMembers.map(m => (
                                    <div key={m.id} className="flex items-center justify-between p-2 rounded hover:bg-zinc-800/30">
                                      <span className="text-sm">@{m.profiles?.username || "user"}</span>
                                    </div>
                                  ))}
                                </div>
                              </ScrollArea>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <label className="text-xs font-bold text-zinc-500 uppercase flex items-center gap-2">
                              <Info className="w-3 h-3" /> Recent Activity (Entry Logs)
                            </label>
                            <ScrollArea className="h-[280px] border border-zinc-800 rounded-md p-2 bg-black/50">
                              <div className="space-y-3">
                                {entryLogs.map(log => (
                                  <div key={log.id} className="text-xs flex flex-col gap-0.5 border-b border-zinc-800/50 pb-2">
                                    <span className="text-zinc-300 font-medium">@{log.profiles?.username || "user"} entered project</span>
                                    <span className="text-[10px] text-zinc-600">{new Date(log.entered_at).toLocaleString()}</span>
                                  </div>
                                ))}
                                {entryLogs.length === 0 && <p className="text-center text-zinc-600 py-8 italic text-xs">No activity yet</p>}
                              </div>
                            </ScrollArea>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>

                    <Dialog open={isSettingsModalOpen} onOpenChange={setIsSettingsModalOpen}>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="w-8 h-8 text-zinc-500 hover:text-zinc-200">
                          <Settings className="w-4 h-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
                        <DialogHeader>
                          <DialogTitle>Project Settings</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <label className="text-sm text-zinc-400">Project Name</label>
                            <Input 
                              value={projectName}
                              onChange={(e) => setProjectName(e.target.value)}
                              className="bg-black border-zinc-700"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm text-zinc-400">Description</label>
                            <Input 
                              value={projectDescription}
                              onChange={(e) => setProjectDescription(e.target.value)}
                              className="bg-black border-zinc-700"
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button onClick={updateProject} className="katler-gradient">Save Changes</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                )}
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
                      <span className="text-[10px] font-bold text-zinc-400">
                        @{m.profiles?.username || "user"}
                      </span>
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
                      m.tag === 'decision' ? 'text-emerald-50/90 font-medium' : 
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
