"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ArrowLeft,
  Check,
  LogOut,
  MessageCircle,
  MoreVertical,
  Plus,
  Search,
  Send,
  UserPlus,
  X,
} from "lucide-react";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Profile = {
  id: string;
  email: string;
  display_name: string | null;
};

type Conversation = {
  id: string;
  created_at: string;
};

type Member = {
  conversation_id: string;
  user_id: string;
  profiles: Profile | Profile[] | null;
};

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

type ChatItem = {
  conversation: Conversation;
  otherUser: Profile;
  lastMessage: Message | null;
};

export default function ChatPage() {
  const router = useRouter();

  const supabase = useMemo(() => createClient(), []);

  const [userId, setUserId] = useState<string | null>(null);
  const [myProfile, setMyProfile] = useState<Profile | null>(null);

  const [chats, setChats] = useState<ChatItem[]>([]);
  const [selectedChat, setSelectedChat] =
    useState<ChatItem | null>(null);

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

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (!selectedChat) {
      setMessages([]);
      return;
    }

    loadMessages(selectedChat.conversation.id);

    const channel = supabase
      .channel(`conversation-${selectedChat.conversation.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${selectedChat.conversation.id}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;

          setMessages((current) => {
            if (
              current.some(
                (message) => message.id === newMessage.id
              )
            ) {
              return current;
            }

            return [...current, newMessage];
          });

          setChats((currentChats) =>
            currentChats.map((chat) =>
              chat.conversation.id ===
              selectedChat.conversation.id
                ? {
                    ...chat,
                    lastMessage: newMessage,
                  }
                : chat
            )
          );
        }
      )
      .subscribe((status) => {
        console.log(
          "Realtime status:",
          status
        );
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedChat, supabase]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

  async function loadUser() {
    setLoading(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      console.error(
        "AUTH USER ERROR:",
        userError.message
      );

      router.replace("/login");
      return;
    }

    if (!user) {
      router.replace("/login");
      return;
    }

    setUserId(user.id);

    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.error(
        "PROFILE ERROR:",
        profileError.message
      );
    }

    setMyProfile(profile);

    await loadChats(user.id);

    setLoading(false);
  }

  async function loadChats(currentUserId: string) {
    const {
      data: memberships,
      error,
    } = await supabase
      .from("conversation_members")
      .select("conversation_id")
      .eq("user_id", currentUserId);

    if (error) {
      console.error(
        "LOAD CHATS ERROR:",
        error.message
      );

      console.error(
        "LOAD CHATS ERROR CODE:",
        error.code
      );

      console.error(
        "LOAD CHATS ERROR DETAILS:",
        error.details
      );

      console.error(
        "LOAD CHATS ERROR HINT:",
        error.hint
      );

      return;
    }

    if (!memberships) {
      setChats([]);
      return;
    }

    const conversationIds = memberships.map(
      (item) => item.conversation_id
    );

    if (conversationIds.length === 0) {
      setChats([]);
      return;
    }

    const {
      data: conversations,
      error: conversationsError,
    } = await supabase
      .from("conversations")
      .select("*")
      .in("id", conversationIds)
      .order("created_at", {
        ascending: false,
      });

    if (conversationsError) {
      console.error(
        "CONVERSATIONS ERROR:",
        conversationsError.message
      );

      return;
    }

    const {
      data: members,
      error: membersError,
    } = await supabase
      .from("conversation_members")
      .select(
        `
        conversation_id,
        user_id,
        profiles (
          id,
          email,
          display_name
        )
      `
      )
      .in(
        "conversation_id",
        conversationIds
      )
      .neq("user_id", currentUserId);

    if (membersError) {
      console.error(
        "MEMBERS ERROR:",
        membersError.message
      );

      return;
    }

    const {
      data: lastMessages,
      error: messagesError,
    } = await supabase
      .from("messages")
      .select("*")
      .in(
        "conversation_id",
        conversationIds
      )
      .order("created_at", {
        ascending: false,
      });

    if (messagesError) {
      console.error(
        "LAST MESSAGES ERROR:",
        messagesError.message
      );

      return;
    }

    if (!conversations || !members) {
      setChats([]);
      return;
    }

    const result: ChatItem[] = [];

    for (const conversation of conversations) {
      const member = members.find(
        (item) =>
          item.conversation_id ===
          conversation.id
      );

      if (
        !member ||
        !member.profiles
      ) {
        continue;
      }

      const lastMessage =
        lastMessages?.find(
          (message) =>
            message.conversation_id ===
            conversation.id
        ) ?? null;

      result.push({
        conversation,
        otherUser: Array.isArray(member.profiles)
          ? member.profiles[0] as Profile
          : member.profiles as Profile,
        lastMessage,
      });
    }

    setChats(result);
  }

  async function loadMessages(
    conversationId: string
  ) {
    const {
      data,
      error,
    } = await supabase
      .from("messages")
      .select("*")
      .eq(
        "conversation_id",
        conversationId
      )
      .order("created_at", {
        ascending: true,
      });

    if (error) {
      console.error(
        "LOAD MESSAGES ERROR:",
        error.message
      );

      return;
    }

    setMessages(data ?? []);
  }

  async function searchUser() {
    setAddError("");
    setAddResult(null);

    const email = addEmail
      .trim()
      .toLowerCase();

    if (!email) {
      setAddError(
        "Enter an email address."
      );

      return;
    }

    const {
      data,
      error,
    } = await supabase.rpc(
      "find_user_by_email",
      {
        target_email: email,
      }
    );

    if (error) {
      setAddError(error.message);
      return;
    }

    if (!data || data.length === 0) {
      setAddError(
        "No FamilyChat account was found with that email."
      );

      return;
    }

    const foundUser =
      data[0] as unknown as Profile;

    if (
      foundUser.id === userId
    ) {
      setAddError(
        "You cannot add yourself."
      );

      return;
    }

    setAddResult(foundUser);
  }

  async function startChat() {
    if (!addResult || !userId) {
      return;
    }

    setAdding(true);
    setAddError("");

    const {
      data,
      error,
    } = await supabase.rpc(
      "get_or_create_direct_conversation",
      {
        target_user_id:
          addResult.id,
      }
    );

    if (error) {
      setAddError(error.message);
      setAdding(false);
      return;
    }

    const conversationId =
      data as string;

    await loadChats(userId);

    const {
      data: conversation,
      error: conversationError,
    } = await supabase
      .from("conversations")
      .select("*")
      .eq(
        "id",
        conversationId
      )
      .single();

    if (conversationError) {
      setAddError(
        conversationError.message
      );

      setAdding(false);
      return;
    }

    if (conversation) {
      const newChat: ChatItem = {
        conversation,
        otherUser: addResult,
        lastMessage: null,
      };

      setSelectedChat(newChat);
    }

    setShowAddChat(false);
    setAddEmail("");
    setAddResult(null);
    setAdding(false);
  }

  async function sendMessage(
    event?: FormEvent
  ) {
    event?.preventDefault();

    const content =
      messageText.trim();

    if (
      !content ||
      !selectedChat ||
      !userId
    ) {
      return;
    }

    setSending(true);

    const {
      error,
    } = await supabase
      .from("messages")
      .insert({
        conversation_id:
          selectedChat.conversation.id,
        sender_id: userId,
        content,
      });

    if (error) {
      console.error(
        "SEND MESSAGE ERROR:",
        error.message
      );

      setSending(false);
      return;
    }

    setMessageText("");
    setSending(false);
  }

  async function logout() {
    await supabase.auth.signOut();

    router.replace("/login");
    router.refresh();
  }

  const filteredChats =
    chats.filter((chat) => {
      const query =
        search.toLowerCase();

      return (
        chat.otherUser.display_name
          ?.toLowerCase()
          .includes(query) ||
        chat.otherUser.email
          .toLowerCase()
          .includes(query)
      );
    });

  function formatTime(
    dateString?: string
  ) {
    if (!dateString) {
      return "";
    }

    return new Date(
      dateString
    ).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function initials(
    profile: Profile
  ) {
    const name =
      profile.display_name ||
      profile.email;

    return name
      .split(" ")
      .map(
        (part) => part[0]
      )
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#07090d] text-white">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500 text-black">
            <MessageCircle />
          </div>

          <p className="text-sm text-gray-400">
            Loading FamilyChat...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="h-screen overflow-hidden bg-[#07090d] text-white">
      <div className="mx-auto flex h-full max-w-[1500px]">

        <aside
          className={`${
            selectedChat
              ? "hidden md:flex"
              : "flex"
          } w-full flex-col border-r border-white/10 bg-[#0a0d12] md:w-[360px]`}
        >

          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">

            <div>
              <div className="flex items-center gap-2">

                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-black">
                  <MessageCircle size={19} />
                </div>

                <h1 className="font-bold">
                  FamilyChat
                </h1>

              </div>

              {myProfile && (
                <p className="mt-1 max-w-[240px] truncate text-xs text-gray-500">
                  {myProfile.email}
                </p>
              )}
            </div>

            <div className="flex items-center gap-1">

              <button
                onClick={() => {
                  setShowAddChat(true);
                  setAddError("");
                  setAddResult(null);
                }}
                className="rounded-xl p-2.5 text-gray-400 transition hover:bg-white/5 hover:text-white"
                title="Add chat"
              >
                <Plus size={20} />
              </button>

              <button
                onClick={logout}
                className="rounded-xl p-2.5 text-gray-400 transition hover:bg-white/5 hover:text-red-400"
                title="Log out"
              >
                <LogOut size={19} />
              </button>

            </div>
          </div>

          <div className="border-b border-white/10 p-4">

            <div className="relative">

              <Search
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
              />

              <input
                value={search}
                onChange={(e) =>
                  setSearch(
                    e.target.value
                  )
                }
                placeholder="Search chats"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-3 pl-10 pr-4 text-sm outline-none transition focus:border-emerald-500/50"
              />

            </div>
          </div>

          <div className="flex-1 overflow-y-auto">

            {filteredChats.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center px-8 text-center">

                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-white/[0.04]">
                  <MessageCircle className="text-gray-500" />
                </div>

                <h2 className="font-bold">
                  {search
                    ? "No chats found"
                    : "No conversations yet"}
                </h2>

                <p className="mt-2 text-sm leading-6 text-gray-500">
                  {search
                    ? "Try another search."
                    : "Add a family member using their email address to start chatting."}
                </p>

                {!search && (
                  <button
                    onClick={() =>
                      setShowAddChat(true)
                    }
                    className="mt-5 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-black"
                  >
                    Add your first chat
                  </button>
                )}

              </div>
            ) : (
              filteredChats.map(
                (chat) => (
                  <button
                    key={
                      chat.conversation.id
                    }
                    onClick={() =>
                      setSelectedChat(
                        chat
                      )
                    }
                    className={`flex w-full items-center gap-3 border-b border-white/[0.05] px-4 py-4 text-left transition hover:bg-white/[0.04] ${
                      selectedChat?.conversation.id ===
                      chat.conversation.id
                        ? "bg-white/[0.06]"
                        : ""
                    }`}
                  >

                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 font-bold text-black">
                      {initials(
                        chat.otherUser
                      )}
                    </div>

                    <div className="min-w-0 flex-1">

                      <div className="flex items-center justify-between gap-3">

                        <span className="truncate font-semibold">
                          {chat.otherUser.display_name ||
                            chat.otherUser.email}
                        </span>

                        <span className="shrink-0 text-[11px] text-gray-500">
                          {formatTime(
                            chat.lastMessage
                              ?.created_at
                          )}
                        </span>

                      </div>

                      <p className="mt-1 truncate text-sm text-gray-500">
                        {chat.lastMessage
                          ?.content ||
                          "Start a conversation"}
                      </p>

                    </div>

                  </button>
                )
              )
            )}

          </div>
        </aside>

        <section
          className={`${
            selectedChat
              ? "flex"
              : "hidden md:flex"
          } flex-1 flex-col bg-[#080b10]`}
        >

          {!selectedChat ? (
            <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">

              <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-[30px] border border-white/10 bg-white/[0.03]">
                <MessageCircle
                  size={40}
                  className="text-emerald-400"
                />
              </div>

              <h2 className="text-3xl font-black">
                Welcome to FamilyChat
              </h2>

              <p className="mt-3 max-w-md text-sm leading-6 text-gray-500">
                Select a conversation from the left or add a family member to begin messaging.
              </p>

            </div>
          ) : (
            <>

              <header className="flex items-center gap-3 border-b border-white/10 bg-[#0a0d12] px-4 py-3">

                <button
                  onClick={() =>
                    setSelectedChat(
                      null
                    )
                  }
                  className="rounded-xl p-2 text-gray-400 hover:bg-white/5 md:hidden"
                >
                  <ArrowLeft size={20} />
                </button>

                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 font-bold text-black">
                  {initials(
                    selectedChat.otherUser
                  )}
                </div>

                <div className="min-w-0 flex-1">

                  <h2 className="truncate font-semibold">
                    {selectedChat.otherUser.display_name ||
                      selectedChat.otherUser.email}
                  </h2>

                  <p className="truncate text-xs text-gray-500">
                    {selectedChat.otherUser.email}
                  </p>

                </div>

                <button className="rounded-xl p-2 text-gray-400 hover:bg-white/5">
                  <MoreVertical size={20} />
                </button>

              </header>

              <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">

                <div className="mx-auto flex max-w-4xl flex-col gap-2">

                  {messages.length === 0 && (
                    <div className="my-auto flex min-h-[60vh] flex-col items-center justify-center text-center">

                      <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-white/[0.04]">
                        <MessageCircle className="text-emerald-400" />
                      </div>

                      <p className="mt-4 font-semibold">
                        Start the conversation
                      </p>

                      <p className="mt-1 text-sm text-gray-500">
                        Send your first message to{" "}
                        {selectedChat.otherUser.display_name ||
                          selectedChat.otherUser.email}
                        .
                      </p>

                    </div>
                  )}

                  {messages.map(
                    (message) => {
                      const mine =
                        message.sender_id ===
                        userId;

                      return (
                        <div
                          key={
                            message.id
                          }
                          className={`flex ${
                            mine
                              ? "justify-end"
                              : "justify-start"
                          }`}
                        >

                          <div
                            className={`max-w-[78%] rounded-2xl px-4 py-2.5 ${
                              mine
                                ? "rounded-br-md bg-emerald-500 text-black"
                                : "rounded-bl-md border border-white/10 bg-white/[0.05] text-white"
                            }`}
                          >

                            <p className="whitespace-pre-wrap break-words text-sm leading-6">
                              {
                                message.content
                              }
                            </p>

                            <div
                              className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
                                mine
                                  ? "text-black/60"
                                  : "text-gray-500"
                              }`}
                            >

                              <span>
                                {formatTime(
                                  message.created_at
                                )}
                              </span>

                              {mine && (
                                <Check
                                  size={
                                    12
                                  }
                                />
                              )}

                            </div>

                          </div>

                        </div>
                      );
                    }
                  )}

                  <div
                    ref={
                      messagesEndRef
                    }
                  />

                </div>
              </div>

              <div className="border-t border-white/10 bg-[#0a0d12] p-3 sm:p-4">

                <form
                  onSubmit={
                    sendMessage
                  }
                  className="mx-auto flex max-w-4xl items-end gap-2"
                >

                  <textarea
                    value={
                      messageText
                    }
                    onChange={(e) =>
                      setMessageText(
                        e.target.value
                      )
                    }
                    onKeyDown={(e) => {
                      if (
                        e.key ===
                          "Enter" &&
                        !e.shiftKey
                      ) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    rows={1}
                    placeholder="Type a message..."
                    className="max-h-32 min-h-[48px] flex-1 resize-none rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm outline-none transition focus:border-emerald-500/50"
                  />

                  <button
                    type="submit"
                    disabled={
                      sending ||
                      !messageText.trim()
                    }
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Send size={19} />
                  </button>

                </form>

              </div>

            </>
          )}

        </section>
      </div>

      {showAddChat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5 backdrop-blur-sm">

          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#10141b] p-6 shadow-2xl">

            <div className="flex items-center justify-between">

              <div>

                <h2 className="text-xl font-bold">
                  Add a new chat
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Enter a registered FamilyChat email.
                </p>

              </div>

              <button
                onClick={() => {
                  setShowAddChat(
                    false
                  );
                  setAddResult(
                    null
                  );
                  setAddError("");
                }}
                className="rounded-xl p-2 text-gray-400 hover:bg-white/5"
              >
                <X size={19} />
              </button>

            </div>

            <div className="mt-6 flex gap-2">

              <input
                type="email"
                value={addEmail}
                onChange={(e) =>
                  setAddEmail(
                    e.target.value
                  )
                }
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter"
                  ) {
                    searchUser();
                  }
                }}
                placeholder="mom@example.com"
                className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/30 px-4 py-3.5 text-sm outline-none focus:border-emerald-500"
              />

              <button
                onClick={
                  searchUser
                }
                className="rounded-2xl bg-white/10 px-4 font-semibold transition hover:bg-white/15"
              >
                Find
              </button>

            </div>

            {addError && (
              <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
                {addError}
              </div>
            )}

            {addResult && (
              <div className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">

                <div className="flex items-center gap-3">

                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 font-bold text-black">
                    {initials(
                      addResult
                    )}
                  </div>

                  <div className="min-w-0 flex-1">

                    <p className="truncate font-bold">
                      {addResult.display_name ||
                        addResult.email}
                    </p>

                    <p className="truncate text-sm text-gray-500">
                      {addResult.email}
                    </p>

                  </div>

                </div>

                <button
                  onClick={
                    startChat
                  }
                  disabled={
                    adding
                  }
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-3 font-bold text-black disabled:opacity-50"
                >

                  <UserPlus
                    size={17}
                  />

                  {adding
                    ? "Starting chat..."
                    : "Start chat"}

                </button>

              </div>
            )}

          </div>
        </div>
      )}

    </main>
  );
}