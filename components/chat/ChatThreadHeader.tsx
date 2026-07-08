import { ArrowLeft, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, getInitials } from "@/lib/utils";
import { conversationLabel } from "@/components/chat/chatFormatters";
import type { ChatCopy, Conversation } from "@/components/chat/chatTypes";

type ChatThreadHeaderProps = {
  selected: Conversation | null | undefined;
  selectedIsGroup: boolean;
  groupDetailsOpen: boolean;
  t: ChatCopy;
  onMobileBack?: () => void;
  onToggleGroupDetails: () => void;
  closeSession: () => void;
};

export function ChatThreadHeader({
  selected,
  selectedIsGroup,
  groupDetailsOpen,
  t,
  onMobileBack,
  onToggleGroupDetails,
  closeSession,
}: ChatThreadHeaderProps) {
  return (
    <div className="goalix-chat-thread-head">
      {selected ? (
        <>
          {onMobileBack && (
            <button
              type="button"
              className="goalix-chat-mobile-back"
              onClick={onMobileBack}
              aria-label={t.back || "Back"}
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            className={cn(
              "goalix-chat-thread-profile",
              selectedIsGroup && "is-clickable",
            )}
            onClick={() => {
              if (selectedIsGroup) {
                onToggleGroupDetails();
              }
            }}
            disabled={!selectedIsGroup}
            aria-expanded={selectedIsGroup ? groupDetailsOpen : undefined}
          >
            <Avatar className="goalix-chat-avatar is-thread">
              <AvatarFallback>
                {getInitials(selected.target.name)}
              </AvatarFallback>
            </Avatar>
            <div className="goalix-chat-thread-title">
              <h2>{selected.target.name}</h2>
              <div>
                <Badge
                  variant={selected.status === "open" ? "success" : "secondary"}
                  className="goalix-chat-status-badge"
                >
                  {selected.status === "open" ? t.open : t.closed}
                </Badge>
                <span>{conversationLabel(selected, t)}</span>
                {selected.context?.playerName && (
                  <span className="goalix-chat-context-pill">
                    {t.about} {selected.context.playerName}
                  </span>
                )}
              </div>
            </div>
          </button>
          {selectedIsGroup && (
            <button
              type="button"
              className="goalix-chat-members-toggle"
              onClick={onToggleGroupDetails}
              aria-label={t.showGroupMembers}
              aria-expanded={groupDetailsOpen}
              title={t.showGroupMembers}
            >
              <Users className="h-4 w-4" />
            </button>
          )}
          {selected.canClose && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="goalix-chat-close-session"
              onClick={closeSession}
            >
              {t.closeSession}
            </Button>
          )}
        </>
      ) : (
        <span className="goalix-chat-muted">{t.selectChat}</span>
      )}
    </div>
  );
}
