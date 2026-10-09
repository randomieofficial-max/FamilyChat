"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Check, LogOut, MessageCircle, Mic, Play, Plus, Search,
  Send, Square, Trash2, UserPlus, X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Profile = { id: string; email: string; display_name: string | null };
type Conversation = { id: string; created_at: string };
type Message = {
  id: string; conversation_id: string; sender_id: string; content: string;
  created_at: string; message_type?: "text" | "voice"; audio_path?: string | null;
  audio_duration_seconds?: number | null;
};
type ChatItem = { conversation: Conversation; otherUser: Profile; lastMessage: Message | null };

export default function ChatPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [myProfile, setMyProfile] = useState<Profile | null>(null);
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [selectedChat, setSelectedChat] = useState<ChatItem | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState("");
  const [search, setSearch] = useState("");
  const [showAddChat, setShowAddChat] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addResult, setAddResult] = useState<Profile | null>(null);
  const [addError, setAddError] = useState("");
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [uploadingVoice, setUploadingVoice] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef(0);
  const durationRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  function stopTimer() {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = null;
  }
  function stopTracks() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  useEffect(() => {
    void loadUser();
    return () => {
      stopTimer();
      stopTracks();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedChat) { setMessages([]); return; }
    const id = selectedChat.conversation.id;
    let alive = true;
    void loadMessages(id);
    const channel = supabase.channel(`conversation-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` }, (payload) => {
        const item = payload.new as Message;
        setMessages((old) => old.some((m) => m.id === item.id) ? old : [...old, item]);
        setChats((old) => old.map((c) => c.conversation.id === id ? { ...c, lastMessage: item } : c));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` }, (payload) => {
        const old = payload.old as { id?: string };
        if (old.id) setMessages((current) => current.filter((m) => m.id !== old.id));
        else if (alive) void loadMessages(id);
      })
      .subscribe();
    return () => { alive = false; void supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChat?.conversation.id, supabase]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function loadUser() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace("/login"); return; }
    setUserId(user.id);
    const { data: profile } = await supabase.from("profiles").select("id,email,display_name").eq("id", user.id).maybeSingle();
    setMyProfile(profile as Profile | null);
    await loadChats(user.id);
    setLoading(false);
  }

  async function loadChats(uid: string) {
    const { data: memberships, error } = await supabase.from("conversation_members").select("conversation_id").eq("user_id", uid);
    if (error) { console.error(error); alert(`Could not load chats: ${error.message}`); return; }
    const ids = [...new Set((memberships ?? []).map((x) => x.conversation_id as string))];
    if (!ids.length) { setChats([]); return; }
    const { data: hidden, error: hiddenError } = await supabase.from("conversation_hidden").select("conversation_id").eq("user_id", uid);
    if (hiddenError) { console.error(hiddenError); alert(`Chat deletion setup error: ${hiddenError.message}`); return; }
    const hiddenIds = new Set((hidden ?? []).map((x) => x.conversation_id as string));
    const visibleIds = ids.filter((id) => !hiddenIds.has(id));
    if (!visibleIds.length) { setChats([]); setSelectedChat(null); return; }
    const [convoResult, memberResult, messageResult] = await Promise.all([
      supabase.from("conversations").select("id,created_at").in("id", visibleIds).order("created_at", { ascending: false }),
      supabase.from("conversation_members").select("conversation_id,user_id,profiles(id,email,display_name)").in("conversation_id", visibleIds).neq("user_id", uid),
      supabase.from("messages").select("id,conversation_id,sender_id,content,created_at,message_type,audio_path,audio_duration_seconds").in("conversation_id", visibleIds).order("created_at", { ascending: false }),
    ]);
    if (convoResult.error || memberResult.error) { console.error(convoResult.error || memberResult.error); return; }
    const result: ChatItem[] = [];
    for (const conversation of convoResult.data ?? []) {
      const member = (memberResult.data ?? []).find((m) => m.conversation_id === conversation.id);
      const p = member?.profiles;
      const profile = (Array.isArray(p) ? p[0] : p) as Profile | null | undefined;
      if (!profile) continue;
      const last = (messageResult.data ?? []).find((m) => m.conversation_id === conversation.id) as Message | undefined;
      result.push({ conversation: conversation as Conversation, otherUser: profile, lastMessage: last ?? null });
    }
    setChats(result);
    if (selectedChat && hiddenIds.has(selectedChat.conversation.id)) setSelectedChat(null);
  }

  async function loadMessages(id: string) {
    const { data, error } = await supabase.from("messages")
      .select("id,conversation_id,sender_id,content,created_at,message_type,audio_path,audio_duration_seconds")
      .eq("conversation_id", id).order("created_at", { ascending: true });
    if (error) { console.error(error); return; }
    setMessages((data ?? []) as Message[]);
  }

  async function searchUser() {
    setAddError(""); setAddResult(null);
    const email = addEmail.trim().toLowerCase();
    if (!email) { setAddError("Enter an email address."); return; }
    const { data, error } = await supabase.rpc("find_user_by_email", { target_email: email });
    if (error) { setAddError(error.message); return; }
    if (!data?.length) { setAddError("No FamilyChat account was found with that email."); return; }
    const person = data[0] as Profile;
    if (person.id === userId) { setAddError("You cannot add yourself."); return; }
    setAddResult(person);
  }

  async function startChat() {
    if (!addResult || !userId) return;
    setAdding(true); setAddError("");
    const { data, error } = await supabase.rpc("get_or_create_direct_conversation", { target_user_id: addResult.id });
    if (error) { setAddError(error.message); setAdding(false); return; }
    const id = data as string;
    const { error: unhideError } = await supabase.from("conversation_hidden").delete().eq("conversation_id", id).eq("user_id", userId);
    if (unhideError) console.error(unhideError);
    const { data: conversation, error: conversationError } = await supabase.from("conversations").select("id,created_at").eq("id", id).single();
    if (conversationError || !conversation) { setAddError(conversationError?.message ?? "Conversation not found."); setAdding(false); return; }
    const chat: ChatItem = { conversation: conversation as Conversation, otherUser: addResult, lastMessage: null };
    setChats((old) => [chat, ...old.filter((c) => c.conversation.id !== id)]);
    setSelectedChat(chat); setShowAddChat(false); setAddEmail(""); setAddResult(null); setAdding(false);
  }

  async function sendMessage(event?: FormEvent) {
    event?.preventDefault();
    const content = messageText.trim();
    if (!content || !selectedChat || !userId || sending) return;
    setSending(true);
    const { error } = await supabase.from("messages").insert({
      conversation_id: selectedChat.conversation.id, sender_id: userId, content,
      message_type: "text", audio_path: null, audio_duration_seconds: null,
    });
    if (error) alert(`Could not send message: ${error.message}`);
    else setMessageText("");
    setSending(false);
  }

  async function deleteMessage(message: Message) {
    if (!userId || message.sender_id !== userId) { alert("You can only delete your own messages."); return; }
    if (!window.confirm("Permanently delete this message?")) return;
    const { error } = await supabase.from("messages").delete().eq("id", message.id).eq("sender_id", userId);
    if (error) { alert(`Could not delete message: ${error.message}`); return; }
    setMessages((old) => old.filter((m) => m.id !== message.id));
    if (message.message_type === "voice" && message.audio_path) {
      const { error: storageError } = await supabase.storage.from("voice-messages").remove([message.audio_path]);
      if (storageError) console.error("Message deleted, but audio cleanup failed:", storageError);
    }
    if (selectedChat && message.conversation_id === selectedChat.conversation.id) {
      const remaining = messages.filter((m) => m.conversation_id === message.conversation_id && m.id !== message.id);
      setChats((old) => old.map((c) => c.conversation.id === message.conversation_id ? { ...c, lastMessage: remaining[remaining.length - 1] ?? null } : c));
    }
  }

  async function deleteChatForMe(chat: ChatItem) {
    if (!userId) return;
    if (!window.confirm(`Remove chat with ${chat.otherUser.display_name || chat.otherUser.email} from your list? They will keep their chat.`)) return;
    const { error } = await supabase.from("conversation_hidden").upsert({ conversation_id: chat.conversation.id, user_id: userId }, { onConflict: "conversation_id,user_id" });
    if (error) { alert(`Could not delete chat: ${error.message}`); return; }
    setChats((old) => old.filter((c) => c.conversation.id !== chat.conversation.id));
    if (selectedChat?.conversation.id === chat.conversation.id) { setSelectedChat(null); setMessages([]); }
  }

  async function startRecording() {
    if (!selectedChat || !userId || recording || uploadingVoice) return;
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      alert("Voice recording is not supported here. Use updated Chrome on HTTPS or localhost."); return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((x) => MediaRecorder.isTypeSupported(x));
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      recorderRef.current = recorder; chunksRef.current = []; setRecordedBlob(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(""); startTimeRef.current = Date.now(); durationRef.current = 0; setRecordingSeconds(0);
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mime || "audio/webm" });
        durationRef.current = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000));
        setRecordingSeconds(durationRef.current); setRecordedBlob(blob); setPreviewUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop()); streamRef.current = null;
      };
      recorder.start(250); setRecording(true);
      timerRef.current = window.setInterval(() => setRecordingSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000)), 1000);
    } catch (e) {
      stopTracks();
      alert(`Microphone access failed: ${e instanceof Error ? e.message : "Unknown error"}. Check Chrome site permissions and Windows microphone privacy settings.`);
    }
  }

  function stopRecording() {
    stopTimer(); setRecording(false);
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
  }

  function cancelRecording() {
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
    stopTimer(); stopTracks(); chunksRef.current = []; setRecording(false); setRecordedBlob(null); setRecordingSeconds(0);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");
  }

  async function sendVoice() {
    if (!selectedChat || !userId || !recordedBlob || uploadingVoice) return;
    if (recordedBlob.size > 10 * 1024 * 1024) { alert("Voice note exceeds 10 MB. Record a shorter note."); return; }
    setUploadingVoice(true);
    const conversationId = selectedChat.conversation.id;
    const extension = recordedBlob.type.includes("mp4") ? "m4a" : "webm";
    const path = `${conversationId}/${userId}/${crypto.randomUUID()}.${extension}`;
    try {
      const { error: uploadError } = await supabase.storage.from("voice-messages").upload(path, recordedBlob, { contentType: recordedBlob.type || "audio/webm", upsert: false });
      if (uploadError) throw uploadError;
      const { error: insertError } = await supabase.from("messages").insert({
        conversation_id: conversationId, sender_id: userId, content: "Voice message",
        message_type: "voice", audio_path: path, audio_duration_seconds: durationRef.current,
      });
      if (insertError) {
        await supabase.storage.from("voice-messages").remove([path]);
        throw insertError;
      }
      cancelRecording();
    } catch (e) {
      alert(`Could not send voice note: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally { setUploadingVoice(false); }
  }

  async function logout() {
    cancelRecording(); await supabase.auth.signOut(); router.replace("/login"); router.refresh();
  }

  const filteredChats = chats.filter((c) => c.otherUser.display_name?.toLowerCase().includes(search.toLowerCase()) || c.otherUser.email.toLowerCase().includes(search.toLowerCase()));
  function time(value?: string) { return value ? new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : ""; }
  function initials(p: Profile) { return (p.display_name || p.email).split(" ").map((x) => x[0]).slice(0, 2).join("").toUpperCase(); }

  if (loading) return <main className="flex min-h-screen items-center justify-center bg-[#07090d] text-white"><div className="text-center"><MessageCircle className="mx-auto mb-4 text-emerald-400" /><p className="text-sm text-gray-400">Loading FamilyChat...</p></div></main>;

  return (
    <main className="h-screen overflow-hidden bg-[#07090d] text-white"><div className="mx-auto flex h-full max-w-[1500px]">
      <aside className={`${selectedChat ? "hidden md:flex" : "flex"} w-full flex-col border-r border-white/10 bg-[#0a0d12] md:w-[380px]`}>
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4"><div><div className="flex items-center gap-2"><MessageCircle className="text-emerald-400" /><h1 className="font-bold">FamilyChat</h1></div>{myProfile && <p className="mt-1 max-w-[240px] truncate text-xs text-gray-500">{myProfile.email}</p>}</div><div className="flex gap-1"><button onClick={() => { setShowAddChat(true); setAddError(""); setAddResult(null); }} title="Add chat" className="rounded-xl p-2.5 text-gray-400 hover:bg-white/5"><Plus /></button><button onClick={() => void logout()} title="Log out" className="rounded-xl p-2.5 text-gray-400 hover:bg-white/5 hover:text-red-400"><LogOut /></button></div></div>
        <div className="border-b border-white/10 p-4"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search chats" className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-3 pl-10 pr-4 text-sm outline-none focus:border-emerald-500/50" /></div></div>
        <div className="flex-1 overflow-y-auto">{filteredChats.length === 0 ? <div className="flex h-full flex-col items-center justify-center px-8 text-center"><MessageCircle className="mb-4 text-gray-500" /><h2 className="font-bold">{search ? "No chats found" : "No conversations yet"}</h2><p className="mt-2 text-sm text-gray-500">{search ? "Try another search." : "Add a family member by email to start chatting."}</p>{!search && <button onClick={() => setShowAddChat(true)} className="mt-5 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-black">Add your first chat</button>}</div> : filteredChats.map((chat) => <div key={chat.conversation.id} className={`flex items-center border-b border-white/[0.05] pr-2 hover:bg-white/[0.04] ${selectedChat?.conversation.id === chat.conversation.id ? "bg-white/[0.06]" : ""}`}><button onClick={() => setSelectedChat(chat)} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-4 text-left"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 font-bold text-black">{initials(chat.otherUser)}</div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><span className="truncate font-semibold">{chat.otherUser.display_name || chat.otherUser.email}</span><span className="text-[11px] text-gray-500">{time(chat.lastMessage?.created_at)}</span></div><p className="mt-1 truncate text-sm text-gray-500">{chat.lastMessage?.message_type === "voice" ? "🎤 Voice message" : chat.lastMessage?.content || "Start a conversation"}</p></div></button><button onClick={() => void deleteChatForMe(chat)} title="Delete chat for me" className="rounded-lg p-2 text-gray-500 hover:bg-red-500/10 hover:text-red-400"><Trash2 size={16} /></button></div>)}</div>
      </aside>
      <section className={`${selectedChat ? "flex" : "hidden md:flex"} flex-1 flex-col bg-[#080b10]`}>
        {!selectedChat ? <div className="flex flex-1 flex-col items-center justify-center px-8 text-center"><MessageCircle size={42} className="mb-6 text-emerald-400" /><h2 className="text-3xl font-black">Welcome to FamilyChat</h2><p className="mt-3 max-w-md text-sm text-gray-500">Select a conversation or add a family member.</p></div> : <>
          <header className="flex items-center gap-3 border-b border-white/10 bg-[#0a0d12] px-4 py-3"><button onClick={() => setSelectedChat(null)} className="rounded-xl p-2 text-gray-400 hover:bg-white/5 md:hidden"><ArrowLeft /></button><div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 font-bold text-black">{initials(selectedChat.otherUser)}</div><div className="min-w-0 flex-1"><h2 className="truncate font-semibold">{selectedChat.otherUser.display_name || selectedChat.otherUser.email}</h2><p className="truncate text-xs text-gray-500">{selectedChat.otherUser.email}</p></div><button onClick={() => void deleteChatForMe(selectedChat)} title="Delete chat for me" className="rounded-xl p-2 text-gray-400 hover:bg-red-500/10 hover:text-red-400"><Trash2 /></button></header>
          <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8"><div className="mx-auto flex max-w-4xl flex-col gap-3">{messages.length === 0 && <div className="flex min-h-[55vh] flex-col items-center justify-center text-center"><MessageCircle className="text-emerald-400" /><p className="mt-4 font-semibold">Start the conversation</p></div>}{messages.map((m) => { const mine = m.sender_id === userId; return <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}><div className={`max-w-[88%] rounded-2xl px-4 py-2.5 sm:max-w-[78%] ${mine ? "rounded-br-md bg-emerald-500 text-black" : "rounded-bl-md border border-white/10 bg-white/[0.05]"}`}>{m.message_type === "voice" && m.audio_path ? <VoicePlayer supabase={supabase} path={m.audio_path} duration={m.audio_duration_seconds ?? null} /> : <p className="whitespace-pre-wrap break-words text-sm leading-6">{m.content}</p>}<div className={`mt-1 flex items-center justify-end gap-2 text-[10px] ${mine ? "text-black/60" : "text-gray-500"}`}><span>{time(m.created_at)}</span>{mine && <Check size={12} />} {mine && <button onClick={() => void deleteMessage(m)} title="Delete message" className="rounded p-1 hover:bg-black/10"><Trash2 size={13} /></button>}</div></div></div>; })}<div ref={endRef} /></div></div>
          <div className="border-t border-white/10 bg-[#0a0d12] p-3 sm:p-4">{recording && <p className="mx-auto mb-2 max-w-4xl text-sm text-red-400">● Recording voice note · {recordingSeconds}s</p>}{recordedBlob && !recording && <div className="mx-auto mb-3 flex max-w-4xl flex-wrap items-center gap-2 rounded-2xl border border-white/10 p-3"><span className="text-sm">Voice preview · {recordingSeconds}s</span>{previewUrl && <audio controls src={previewUrl} className="min-w-[180px] flex-1" />}<button onClick={cancelRecording} className="rounded-xl border border-white/10 px-3 py-2 text-sm">Cancel</button><button onClick={() => void sendVoice()} disabled={uploadingVoice} className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-black disabled:opacity-50">{uploadingVoice ? "Sending…" : "Send voice"}</button></div>}<form onSubmit={(e) => void sendMessage(e)} className="mx-auto flex max-w-4xl items-end gap-2"><textarea value={messageText} onChange={(e) => setMessageText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendMessage(); } }} rows={1} placeholder="Type a message..." className="max-h-32 min-h-[48px] flex-1 resize-none rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm outline-none focus:border-emerald-500/50" /><button type="button" onClick={recording ? stopRecording : () => void startRecording()} disabled={uploadingVoice || Boolean(recordedBlob)} title={recording ? "Stop recording" : "Record voice message"} className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 disabled:opacity-40 ${recording ? "bg-red-500 text-white" : "text-emerald-400"}`}>{recording ? <Square size={17} /> : <Mic size={20} />}</button><button type="submit" disabled={sending || !messageText.trim()} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-black disabled:opacity-40"><Send size={19} /></button></form><p className="mx-auto mt-2 max-w-4xl text-[11px] text-gray-600">Voice notes require microphone permission and HTTPS (localhost is fine for testing).</p></div>
        </>}
      </section>
    </div>
    {showAddChat && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5 backdrop-blur-sm"><div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#10141b] p-6 shadow-2xl"><div className="flex items-center justify-between"><div><h2 className="text-xl font-bold">Add a new chat</h2><p className="mt-1 text-sm text-gray-500">Enter a registered FamilyChat email.</p></div><button onClick={() => { setShowAddChat(false); setAddResult(null); setAddError(""); }} className="rounded-xl p-2 text-gray-400"><X /></button></div><div className="mt-6 flex gap-2"><input type="email" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void searchUser(); }} placeholder="mom@example.com" className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/30 px-4 py-3.5 text-sm outline-none focus:border-emerald-500" /><button onClick={() => void searchUser()} className="rounded-2xl bg-white/10 px-4 font-semibold">Find</button></div>{addError && <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">{addError}</div>}{addResult && <div className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4"><p className="font-bold">{addResult.display_name || addResult.email}</p><p className="text-sm text-gray-500">{addResult.email}</p><button onClick={() => void startChat()} disabled={adding} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-3 font-bold text-black disabled:opacity-50"><UserPlus size={17} />{adding ? "Starting chat..." : "Start chat"}</button></div>}</div></div>}
    </main>
  );
}

function VoicePlayer({ supabase, path, duration }: { supabase: ReturnType<typeof createClient>; path: string; duration: number | null }) {
  const [url, setUrl] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void supabase.storage.from("voice-messages").createSignedUrl(path, 3600).then(({ data, error }) => {
      if (cancelled) return;
      if (error || !data?.signedUrl) setFailed(true);
      else setUrl(data.signedUrl);
    });
    return () => { cancelled = true; };
  }, [supabase, path]);
  if (failed) return <p className="text-sm">Voice message unavailable</p>;
  if (!url) return <p className="text-sm">Loading voice note…</p>;
  return <div className="flex min-w-[220px] items-center gap-2"><Play size={16} /><audio controls preload="none" src={url} className="max-w-full flex-1" /><span className="text-xs">{duration ?? 0}s</span></div>;
}
