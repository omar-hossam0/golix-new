"use client";

import "@/app/chat.css";

import {
  FormEvent,
  startTransition,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { io, type Socket } from "socket.io-client";
import {
  Check,
  Edit3,
  ImagePlus,
  Loader2,
  Lock,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/lib/auth/auth-context";
import { hasAuthSessionMarker } from "@/lib/auth/session";
import { refreshAuthSession } from "@/lib/auth/refreshSession";
import { getSocketBaseUrl } from "@/lib/api/baseUrl";
import { useDashboardLanguage } from "@/lib/hooks/useDashboardLanguage";
import { useAppDispatch } from "@/lib/store/hooks";
import { loginSuccess, logout } from "@/lib/store/slices/authSlice";
import { mapApiUser } from "@/lib/auth/mapApiUser";
import { chatCopy } from "@/lib/chatTranslations";
import { ChatContactsPanel } from "@/components/chat/ChatContactsPanel";
import { ChatConversationsPanel } from "@/components/chat/ChatConversationsPanel";
import { ChatGroupDetails } from "@/components/chat/ChatGroupDetails";
import { ChatThreadHeader } from "@/components/chat/ChatThreadHeader";
import { MessageReceipt } from "@/components/chat/MessageReceipt";
import {
  absoluteUploadUrl,
  allowedImageTypes,
  apiJson,
  maxChatImageBytes,
} from "@/components/chat/chatApi";
import {
  chatErrorMessage,
  contactRoleLabel,
  conversationLabel,
  normalizeSearch,
} from "@/components/chat/chatFormatters";
import type {
  ChatRole,
  Contact,
  ContactsResponse,
  Conversation,
  Message,
} from "@/components/chat/chatTypes";

const copy = chatCopy;

export function ChatWorkspace({ role }: { role: ChatRole }) {
  const language = useDashboardLanguage();
  const t = copy[language];
  const dispatch = useAppDispatch();
  const { user, isAuthenticated, isInitialized } = useCurrentUser();
  const [contacts, setContacts] = useState<ContactsResponse>({});
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [connectionWarning, setConnectionWarning] = useState("");
  const [groupComposerOpen, setGroupComposerOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupSearch, setGroupSearch] = useState("");
  const [groupMemberUserIds, setGroupMemberUserIds] = useState<string[]>([]);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [groupDetailsOpen, setGroupDetailsOpen] = useState(false);
  const [realtimeReady, setRealtimeReady] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const selectedRef = useRef<string | null>(null);
  const readMarkingRef = useRef<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const textRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    selectedRef.current = selectedId;
  }, [selectedId]);

  const selected = useMemo(
    () =>
      conversations.find((conversation) => conversation.id === selectedId) ||
      null,
    [conversations, selectedId],
  );

  const upsertConversation = useCallback((conversation: Conversation) => {
    setConversations((prev) => {
      const next = [
        conversation,
        ...prev.filter((item) => item.id !== conversation.id),
      ];
      return next.sort((a, b) => {
        const aTime = new Date(a.last_message_at || a.created_at).getTime();
        const bTime = new Date(b.last_message_at || b.created_at).getTime();
        return bTime - aTime;
      });
    });
  }, []);

  const upsertMessage = useCallback((message: Message) => {
    if (message.conversation_id !== selectedRef.current) return;
    setMessages((prev) => {
      const next = prev.some((item) => item.id === message.id)
        ? prev.map((item) => (item.id === message.id ? message : item))
        : [...prev, message];
      return next.sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
    });
  }, []);

  const replaceMessage = useCallback((message: Message) => {
    if (message.conversation_id !== selectedRef.current) return;
    setMessages((prev) =>
      prev.map((current) =>
        current.id === message.id
          ? {
              ...current,
              ...message,
              id: current.id,
              conversation_id: current.conversation_id,
              sender_user_id: current.sender_user_id,
              sender_name: current.sender_name,
              sender_role: current.sender_role,
              created_at: current.created_at,
            }
          : current,
      ),
    );
  }, []);

  const upsertMessages = useCallback((updatedMessages: Message[]) => {
    setMessages((prev) => {
      let changed = false;
      const next = prev.map((message) => {
        const updated = updatedMessages.find((item) => item.id === message.id);
        if (!updated) return message;
        changed = true;
        return updated;
      });
      return changed ? next : prev;
    });
  }, []);

  const handleMessageDeleted = useCallback((message: Message) => {
    if (message.conversation_id !== selectedRef.current) return;
    if (message.visibility === "self") {
      setMessages((prev) => prev.filter((item) => item.id !== message.id));
      setEditingMessage((current) =>
        current?.id === message.id ? null : current,
      );
      return;
    }
    setMessages((prev) =>
      prev.map((item) =>
        item.id === message.id ? { ...item, ...message } : item,
      ),
    );
    setEditingMessage((current) =>
      current?.id === message.id ? null : current,
    );
  }, []);

  const ensureFreshSession = useCallback(async () => {
    if (!hasAuthSessionMarker()) return true;
    const refresh = await refreshAuthSession();
    if (refresh.ok) {
      const refreshedUser = mapApiUser(refresh.user);
      dispatch(loginSuccess({ user: refreshedUser, role: refreshedUser.role }));
      return true;
    }
    if (refresh.unauthorized) {
      dispatch(logout());
      return false;
    }
    return true;
  }, [dispatch]);

  const loadConversations = useCallback(async () => {
    const canContinue = await ensureFreshSession();
    if (!canContinue) return;
    const conversationsData = await apiJson<Conversation[]>("/conversations");
    setConversations(conversationsData);
    setSelectedId((current) => current || conversationsData[0]?.id || null);
  }, [ensureFreshSession]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const canContinue = await ensureFreshSession();
      if (!canContinue) return;
      const [contactsData, conversationsData] = await Promise.all([
        apiJson<ContactsResponse>("/contacts"),
        apiJson<Conversation[]>("/conversations"),
      ]);
      setContacts(contactsData);
      setConversations(conversationsData);
      setSelectedId((current) => current || conversationsData[0]?.id || null);
    } catch (err) {
      setError(chatErrorMessage(err, t, t.loadChatFailed));
    } finally {
      setLoading(false);
    }
  }, [ensureFreshSession, t]);

  useEffect(() => {
    if (!isInitialized) return;
    if (!isAuthenticated) {
      startTransition(() => {
        setLoading(false);
        setContacts({});
        setConversations([]);
        setMessages([]);
        setSelectedId(null);
        setMobileThreadOpen(false);
        setConnectionWarning("");
        setRealtimeReady(false);
      });
      return;
    }
    const loadTimer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(loadTimer);
  }, [isAuthenticated, isInitialized, load]);

  useEffect(() => {
    if (!isInitialized || !isAuthenticated) return;
    let cancelled = false;
    startTransition(() => setRealtimeReady(false));

    const refreshBeforeRealtime = async () => {
      const canContinue = await ensureFreshSession();

      if (!cancelled && canContinue) setRealtimeReady(true);
    };

    void refreshBeforeRealtime();

    return () => {
      cancelled = true;
    };
  }, [ensureFreshSession, isAuthenticated, isInitialized]);

  useEffect(() => {
    if (!isInitialized || !isAuthenticated || !realtimeReady) return;
    const socket = io(getSocketBaseUrl(), {
      withCredentials: true,
      transports: ["polling", "websocket"],
      reconnectionAttempts: 5,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnectionWarning("");
    });
    socket.on("chat:message", upsertMessage);
    socket.on("chat:message_updated", replaceMessage);
    socket.on("chat:message_deleted", handleMessageDeleted);
    socket.on("chat:messages_read", upsertMessages);
    socket.on("chat:conversation", () => {
      void loadConversations();
    });
    socket.on("chat:session_closed", () => {
      void loadConversations();
    });
    socket.on("connect_error", () => {
      setConnectionWarning(t.liveConnectionFailed);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [
    handleMessageDeleted,
    isAuthenticated,
    isInitialized,
    loadConversations,
    realtimeReady,
    replaceMessage,
    t,
    upsertMessage,
    upsertMessages,
  ]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !selectedId) return;
    socket.emit("chat:join", { conversationId: selectedId });
    return () => {
      socket.emit("chat:leave", { conversationId: selectedId });
    };
  }, [selectedId]);

  useEffect(() => {
    if (!isInitialized || !isAuthenticated || !selectedId) {
      startTransition(() => setMessages([]));
      return;
    }
    startTransition(() => {
      setMessagesLoading(true);
      setError("");
    });
    apiJson<Message[]>(`/conversations/${selectedId}/messages`)
      .then(setMessages)
      .catch((err) => setError(chatErrorMessage(err, t, t.loadMessagesFailed)))
      .finally(() => setMessagesLoading(false));
  }, [isAuthenticated, isInitialized, selectedId, t]);

  useEffect(() => {
    if (!isInitialized || !isAuthenticated || !selectedId || !user?.id) return;
    if (
      !messages.some(
        (message) => message.sender_user_id !== user.id && !message.read_at,
      )
    ) {
      return;
    }
    if (readMarkingRef.current === selectedId) return;
    readMarkingRef.current = selectedId;
    apiJson<Message[]>(`/conversations/${selectedId}/read`, { method: "PATCH" })
      .then(upsertMessages)
      .catch(() => null)
      .finally(() => {
        if (readMarkingRef.current === selectedId) {
          readMarkingRef.current = null;
        }
      });
  }, [
    isAuthenticated,
    isInitialized,
    messages,
    selectedId,
    upsertMessages,
    user?.id,
  ]);

  const filteredContacts = useMemo(() => {
    const needle = normalizeSearch(query);
    const filter = (items: Contact[] = []) =>
      needle
        ? items.filter((item) =>
            normalizeSearch(`${item.name} ${item.subtitle || ""}`).includes(
              needle,
            ),
          )
        : items;
    return {
      admins: filter(contacts.admins),
      coaches: filter(contacts.coaches),
      players: filter(contacts.players),
      parents: filter(contacts.parents),
      children: filter(contacts.children),
    };
  }, [contacts, query]);

  const filteredConversations = useMemo(() => {
    const needle = normalizeSearch(query);
    if (!needle) return conversations;
    return conversations.filter((conversation) =>
      normalizeSearch(
        `${conversation.target.name} ${conversation.last_message_body || ""} ${conversationLabel(conversation, t)}`,
      ).includes(needle),
    );
  }, [conversations, query, t]);

  const groupCandidateContacts = useMemo(() => {
    if (role !== "coach") return [];
    const byUserId = new Map<string, Contact>();
    [
      ...(contacts.admins || []),
      ...(contacts.coaches || []),
      ...(contacts.players || []),
      ...(contacts.parents || []),
    ].forEach((contact) => {
      if (!contact.user_id || contact.user_id === user?.id) return;
      byUserId.set(contact.user_id, contact);
    });
    return [...byUserId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [
    contacts.admins,
    contacts.coaches,
    contacts.parents,
    contacts.players,
    role,
    user?.id,
  ]);

  const filteredGroupCandidateContacts = useMemo(() => {
    const needle = normalizeSearch(groupSearch);
    if (!needle) return groupCandidateContacts;
    return groupCandidateContacts.filter((contact) =>
      normalizeSearch(
        `${contact.name} ${contact.subtitle || ""} ${contactRoleLabel(contact.type, t)}`,
      ).includes(needle),
    );
  }, [groupCandidateContacts, groupSearch, t]);

  const toggleGroupMember = useCallback((userId: string) => {
    setGroupMemberUserIds((current) =>
      current.includes(userId)
        ? current.filter((item) => item !== userId)
        : [...current, userId],
    );
  }, []);

  const resetGroupComposer = useCallback(() => {
    setGroupComposerOpen(false);
    setGroupName("");
    setGroupSearch("");
    setGroupMemberUserIds([]);
    setCreatingGroup(false);
  }, []);

  async function createChatGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (role !== "coach" || creatingGroup) return;
    if (!groupName.trim()) {
      setError(t.groupNameRequired);
      return;
    }
    if (!groupMemberUserIds.length) {
      setError(t.chooseGroupMember);
      return;
    }

    setCreatingGroup(true);
    setError("");
    try {
      const conversation = await apiJson<Conversation>("/conversations", {
        method: "POST",
        body: JSON.stringify({
          type: "chat_group",
          groupName: groupName.trim(),
          memberUserIds: groupMemberUserIds,
        }),
      });
      upsertConversation(conversation);
      setSelectedId(conversation.id);
      setMobileThreadOpen(true);
      setGroupDetailsOpen(true);
      setEditingMessage(null);
      setBody("");
      setImage(null);
      resetGroupComposer();
    } catch (err) {
      setError(chatErrorMessage(err, t, t.createGroupFailed));
    } finally {
      setCreatingGroup(false);
    }
  }

  async function openConversation(contact: Contact) {
    setError("");
    try {
      let payload: Record<string, string>;
      if (role === "admin" && contact.type === "coach") {
        payload = { type: "admin_coach", coachId: contact.id };
      } else if (role === "coach" && contact.type === "admin") {
        payload = { type: "admin_coach", adminUserId: contact.user_id };
      } else if (role === "admin" && contact.type === "player") {
        payload = { type: "admin_player_session", playerId: contact.id };
      } else if (role === "coach" && contact.type === "player") {
        payload = { type: "coach_player", playerId: contact.id };
      } else if (role === "player" && contact.type === "coach") {
        payload = { type: "coach_player", coachId: contact.id };
      } else if (
        role === "parent" &&
        contact.type === "coach" &&
        contact.player_id
      ) {
        payload = {
          type: "parent_coach",
          coachId: contact.id,
          playerId: contact.player_id,
        };
      } else if (
        role === "coach" &&
        contact.type === "parent" &&
        contact.player_id
      ) {
        payload = {
          type: "parent_coach",
          parentUserId: contact.user_id,
          playerId: contact.player_id,
        };
      } else if (role === "coach" && contact.type === "coach") {
        const conversation = await apiJson<Conversation>("/conversations", {
          method: "POST",
          body: JSON.stringify({
            type: "chat_group",
            groupName: contact.name,
            memberUserIds: [contact.user_id],
          }),
        });
        upsertConversation(conversation);
        setSelectedId(conversation.id);
        setMobileThreadOpen(true);
        setGroupDetailsOpen(false);
        setEditingMessage(null);
        setBody("");
        setImage(null);
        return;
      } else {
        return;
      }
      const conversation = await apiJson<Conversation>("/conversations", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      upsertConversation(conversation);
      setSelectedId(conversation.id);
      setMobileThreadOpen(true);
      setGroupDetailsOpen(false);
      setEditingMessage(null);
      setBody("");
      setImage(null);
    } catch (err) {
      setError(chatErrorMessage(err, t, t.openFailed));
    }
  }

  async function closeSession() {
    if (!selected) return;
    setError("");
    try {
      const conversation = await apiJson<Conversation>(
        `/conversations/${selected.id}/close`,
        { method: "PATCH" },
      );
      upsertConversation(conversation);
    } catch (err) {
      setError(chatErrorMessage(err, t, t.closeFailed));
    }
  }

  async function submitMessage() {
    if (!selected || !selected.canSend || sending) return;
    if (editingMessage && !body.trim()) return;
    if (!editingMessage && !body.trim() && !image) return;
    setSending(true);
    setError("");
    try {
      if (editingMessage) {
        const originalMessage = editingMessage;
        const updatedBody = body.trim();
        replaceMessage({
          ...originalMessage,
          body: updatedBody,
          edited_at: new Date().toISOString(),
        });
        setEditingMessage(null);
        setBody("");
        try {
          const message = await apiJson<Message>(
            `/conversations/${selected.id}/messages/${originalMessage.id}`,
            {
              method: "PATCH",
              body: JSON.stringify({ body: updatedBody }),
            },
          );
          replaceMessage(message);
        } catch (error) {
          replaceMessage(originalMessage);
          if (selectedRef.current === originalMessage.conversation_id) {
            setEditingMessage(originalMessage);
            setBody(updatedBody);
          }
          throw error;
        }
        return;
      }

      const form = new FormData();
      form.append("body", body.trim());
      if (image) form.append("image", image);
      const message = await apiJson<Message>(
        `/conversations/${selected.id}/messages`,
        {
          method: "POST",
          body: form,
        },
      );
      upsertMessage(message);
      setBody("");
      setImage(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      setError(chatErrorMessage(err, t, t.sendFailed));
    } finally {
      setSending(false);
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitMessage();
  }

  function startEdit(message: Message) {
    setEditingMessage(message);
    setImage(null);
    setBody(message.body || "");
    requestAnimationFrame(() => textRef.current?.focus());
  }

  function cancelEdit() {
    setEditingMessage(null);
    setBody("");
  }

  function handleImageChange(file?: File | null) {
    if (!file) {
      setImage(null);
      return;
    }
    if (!allowedImageTypes.has(file.type)) {
      setError(t.invalidImage);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    if (file.size > maxChatImageBytes) {
      setError(t.imageTooLarge);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setError("");
    setImage(file);
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    const isEnter =
      event.key === "Enter" || event.code === "Enter" || event.keyCode === 13;
    if (!isEnter || event.shiftKey) return;
    event.preventDefault();
    event.stopPropagation();
    void submitMessage();
  }

  async function deleteMessage(message: Message, scope: "me" | "everyone") {
    if (!selected || deletingId) return;
    setDeletingId(message.id);
    setError("");
    try {
      const deleted = await apiJson<Message>(
        `/conversations/${selected.id}/messages/${message.id}?scope=${scope}`,
        { method: "DELETE" },
      );
      handleMessageDeleted(deleted);
    } catch (err) {
      setError(chatErrorMessage(err, t, t.deleteFailed));
    } finally {
      setDeletingId(null);
    }
  }

  const selectedIsGroup = selected?.type === "chat_group";
  const selectedGroupMembers = selectedIsGroup
    ? selected.group_members || []
    : [];
  const canSubmitMessage = Boolean(
    selected?.canSend &&
    !sending &&
    (editingMessage ? body.trim() : body.trim() || image),
  );

  if (!isInitialized || !isAuthenticated) {
    return <div className="goalix-chat-empty-auth">{t.signInAgain}</div>;
  }

  return (
    <div
      className={cn(
        "goalix-chat-shell",
        selected && mobileThreadOpen && "is-thread-open",
      )}
      dir={language === "ar" ? "rtl" : "ltr"}
    >
      <ChatConversationsPanel
        t={t}
        loading={loading}
        filteredConversations={filteredConversations}
        selectedId={selectedId}
        query={query}
        onSelectConversation={(conversationId) => {
          setSelectedId(conversationId);
          setMobileThreadOpen(true);
          setGroupDetailsOpen(false);
        }}
      />

      <main className="goalix-chat-panel goalix-chat-thread">
        <ChatThreadHeader
          selected={selected}
          selectedIsGroup={selectedIsGroup}
          groupDetailsOpen={groupDetailsOpen}
          t={t}
          onMobileBack={() => {
            setMobileThreadOpen(false);
            setGroupDetailsOpen(false);
          }}
          onToggleGroupDetails={() =>
            setGroupDetailsOpen((current) => !current)
          }
          closeSession={closeSession}
        />

        <ChatGroupDetails
          selectedIsGroup={selectedIsGroup}
          groupDetailsOpen={groupDetailsOpen}
          selectedGroupMembers={selectedGroupMembers}
          t={t}
          onClose={() => setGroupDetailsOpen(false)}
        />

        <div className="goalix-chat-messages">
          {messagesLoading && (
            <div className="goalix-chat-center">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}
          {!messagesLoading && selected && messages.length === 0 && (
            <div className="goalix-chat-center">{t.noMessages}</div>
          )}
          {!messagesLoading && !selected && (
            <div className="goalix-chat-center">{t.noChatSelected}</div>
          )}
          <div className="goalix-chat-message-stack">
            {messages.map((message) => {
              const mine = message.sender_user_id === user?.id;
              const deletedForEveryone = Boolean(message.deleted_at);
              return (
                <div
                  key={message.id}
                  className={cn(
                    "goalix-chat-message-row",
                    mine ? "is-own" : "is-other",
                  )}
                >
                  <div className="goalix-chat-bubble">
                    <div className="goalix-chat-message-meta">
                      <span>
                        {mine ? t.you : message.sender_name || t.user}
                      </span>
                      <span>
                        {new Date(message.created_at).toLocaleTimeString(
                          language === "ar" ? "ar-EG" : "en-US",
                          { hour: "2-digit", minute: "2-digit" },
                        )}
                      </span>
                      {message.edited_at && !deletedForEveryone && (
                        <span>{t.edited}</span>
                      )}
                      {mine && (
                        <span className="goalix-chat-message-actions">
                          <MessageReceipt message={message} t={t} />
                          {selected?.canSend && message.body && (
                            <button
                              type="button"
                              onClick={() => startEdit(message)}
                              className="goalix-chat-icon-button"
                              title={t.editMessage}
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </span>
                      )}
                      {selected?.canSend && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              disabled={deletingId === message.id}
                              className="goalix-chat-icon-button is-danger"
                              title={t.deleteMessage}
                            >
                              {deletingId === message.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align={mine ? "end" : "start"}
                            className="border-[#2b4661] bg-[#07172a] text-slate-100"
                          >
                            <DropdownMenuItem
                              className="cursor-pointer focus:bg-white/10"
                              onClick={() => deleteMessage(message, "me")}
                            >
                              {t.deleteForMe}
                            </DropdownMenuItem>
                            {mine && !deletedForEveryone && (
                              <>
                                <DropdownMenuSeparator className="bg-[#2b4661]" />
                                <DropdownMenuItem
                                  className="cursor-pointer text-red-200 focus:bg-red-500/15 focus:text-red-100"
                                  onClick={() =>
                                    deleteMessage(message, "everyone")
                                  }
                                >
                                  {t.deleteForEveryone}
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                    {message.body ? (
                      <p className="goalix-chat-message-text">{message.body}</p>
                    ) : null}
                    {!deletedForEveryone && message.attachment_url && (
                      <a
                        href={absoluteUploadUrl(message.attachment_url)}
                        target="_blank"
                        rel="noreferrer"
                        className="goalix-chat-attachment"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={absoluteUploadUrl(message.attachment_url)}
                          alt={message.attachment_original_name || t.image}
                          crossOrigin="use-credentials"
                          loading="lazy"
                          decoding="async"
                          className="max-h-[340px] w-full object-contain"
                        />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <form onSubmit={sendMessage} className="goalix-chat-composer">
          {error && <div className="goalix-chat-alert is-error">{error}</div>}
          {connectionWarning && (
            <div className="goalix-chat-alert is-warning">
              {connectionWarning}
            </div>
          )}
          {selected?.status === "closed" && (
            <div className="goalix-chat-alert">
              <Lock className="h-4 w-4" />
              {t.sessionClosed}
            </div>
          )}
          {editingMessage && (
            <div className="goalix-chat-alert is-editing">
              <Edit3 className="h-4 w-4" />
              <span className="min-w-0 flex-1 truncate">
                {t.editingMessage}
              </span>
              <button type="button" onClick={cancelEdit}>
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          {image && (
            <div className="goalix-chat-alert is-image">
              <ImagePlus className="h-4 w-4" />
              <span className="min-w-0 flex-1 truncate">{image.name}</span>
              <button type="button" onClick={() => setImage(null)}>
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          <div className="goalix-chat-composer-row">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              className="hidden"
              onChange={(event) => handleImageChange(event.target.files?.[0])}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={
                !selected?.canSend || sending || Boolean(editingMessage)
              }
              className="goalix-chat-attach-button"
              onClick={() => fileRef.current?.click()}
              title={t.attachImage}
            >
              <ImagePlus className="h-4 w-4" />
            </Button>
            <Textarea
              ref={textRef}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              rows={2}
              maxLength={4000}
              disabled={!selected?.canSend || sending}
              placeholder={selected?.canSend ? t.message : ""}
              className="goalix-chat-input"
            />
            <Button
              type="submit"
              disabled={!canSubmitMessage}
              className="goalix-chat-send-button"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : editingMessage ? (
                <Check className="h-4 w-4" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              <span className="goalix-chat-send-label">
                {editingMessage ? t.save : t.send}
              </span>
            </Button>
          </div>
        </form>
      </main>

      <ChatContactsPanel
        role={role}
        t={t}
        query={query}
        setQuery={setQuery}
        groupComposerOpen={groupComposerOpen}
        setGroupComposerOpen={setGroupComposerOpen}
        createChatGroup={createChatGroup}
        resetGroupComposer={resetGroupComposer}
        groupName={groupName}
        setGroupName={setGroupName}
        groupSearch={groupSearch}
        setGroupSearch={setGroupSearch}
        groupMemberUserIds={groupMemberUserIds}
        filteredGroupCandidateContacts={filteredGroupCandidateContacts}
        groupCandidateContacts={groupCandidateContacts}
        toggleGroupMember={toggleGroupMember}
        creatingGroup={creatingGroup}
        filteredContacts={filteredContacts}
        openConversation={openConversation}
      />
    </div>
  );
}
