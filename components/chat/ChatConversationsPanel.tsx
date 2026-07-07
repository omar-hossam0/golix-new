import { Loader2, Lock, MessageSquare } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, getInitials } from "@/lib/utils";
import { conversationLabel } from "@/components/chat/chatFormatters";
import type { ChatCopy, Conversation } from "@/components/chat/chatTypes";

type ChatConversationsPanelProps = {
  t: ChatCopy;
  loading: boolean;
  filteredConversations: Conversation[];
  selectedId: string | null;
  query: string;
  onSelectConversation: (conversationId: string) => void;
};

export function ChatConversationsPanel({
  t,
  loading,
  filteredConversations,
  selectedId,
  query,
  onSelectConversation,
}: ChatConversationsPanelProps) {
  return (
    <aside className="goalix-chat-panel goalix-chat-conversations">
      <div className="goalix-chat-panel-head">
        <MessageSquare className="goalix-chat-head-icon" />
        <h1>{t.chats}</h1>
        {loading && <Loader2 className="goalix-chat-loading" />}
      </div>
      <div className="goalix-chat-scroll">
        {filteredConversations.map((conversation) => (
          <button
            key={conversation.id}
            onClick={() => onSelectConversation(conversation.id)}
            className={cn(
              "goalix-chat-list-card",
              selectedId === conversation.id && "is-active",
              conversation.status === "closed" && "is-locked",
            )}
          >
            <Avatar className="goalix-chat-avatar">
              <AvatarFallback>
                {getInitials(conversation.target.name)}
              </AvatarFallback>
            </Avatar>
            <span className="goalix-chat-list-copy">
              <span className="goalix-chat-list-title">
                {conversation.target.name}
              </span>
              <span className="goalix-chat-list-subtitle">
                {conversation.last_message_body ||
                  (conversation.last_attachment_url ? t.image : conversationLabel(conversation, t))}
              </span>
            </span>
            {conversation.status === "closed" && <Lock className="goalix-chat-lock" />}
          </button>
        ))}
        {!loading && filteredConversations.length === 0 && (
          <div className="goalix-chat-empty-state">
            {query.trim() ? t.noChatsSearch : t.noChats}
          </div>
        )}
      </div>
    </aside>
  );
}
