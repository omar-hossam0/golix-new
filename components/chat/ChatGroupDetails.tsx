import { X } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import { formatContactSubtitle } from "@/components/chat/chatFormatters";
import type { ChatCopy, GroupMember } from "@/components/chat/chatTypes";

type ChatGroupDetailsProps = {
  selectedIsGroup: boolean;
  groupDetailsOpen: boolean;
  selectedGroupMembers: GroupMember[];
  t: ChatCopy;
  onClose: () => void;
};

export function ChatGroupDetails({
  selectedIsGroup,
  groupDetailsOpen,
  selectedGroupMembers,
  t,
  onClose,
}: ChatGroupDetailsProps) {
  if (!selectedIsGroup || !groupDetailsOpen) return null;

  return (
    <div className="goalix-chat-group-details">
      <div className="goalix-chat-group-details-head">
        <div>
          <strong>{t.groupMembers}</strong>
          <span>{selectedGroupMembers.length} {t.members}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          title={t.closeMembers}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="goalix-chat-group-details-list">
        {selectedGroupMembers.map((member) => (
          <div
            key={member.userId}
            className="goalix-chat-group-details-member"
          >
            <Avatar className="goalix-chat-avatar is-contact">
              <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
            </Avatar>
            <span className="goalix-chat-list-copy">
              <span className="goalix-chat-list-title">
                {member.name}
              </span>
              <span className="goalix-chat-list-subtitle">
                {formatContactSubtitle(member.role, t)}
                {member.membershipRole === "owner" ? ` | ${t.owner}` : ""}
              </span>
            </span>
          </div>
        ))}
        {selectedGroupMembers.length === 0 && (
          <div className="goalix-chat-empty-state is-compact">
            {t.noMembersFound}
          </div>
        )}
      </div>
    </div>
  );
}
