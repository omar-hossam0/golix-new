import { chatCopy } from "@/lib/chatTranslations";
import type { ChatCopy, ContactType, Conversation } from "@/components/chat/chatTypes";

export function normalizeSearch(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function conversationLabel(conversation: Conversation, t: ChatCopy) {
  if (conversation.type === "chat_group") return groupMembersPreview(conversation, t);
  if (conversation.type === "admin_player_session") return t.adminSession;
  if (conversation.target.type === "admin") return t.admin;
  if (conversation.target.type === "coach") return t.coach;
  if (conversation.target.type === "player") return t.player;
  if (conversation.target.type === "parent") return t.parent;
  if (conversation.type === "parent_coach") {
    return conversation.context?.playerName
      ? `${t.familyChat} - ${conversation.context.playerName}`
      : t.familyChat;
  }
  return t.coach;
}

function groupMemberNames(conversation: Conversation) {
  return (conversation.group_members || [])
    .map((member) => member.name)
    .filter(Boolean);
}

function groupMembersPreview(conversation: Conversation, t: ChatCopy) {
  const names = groupMemberNames(conversation);
  if (!names.length) {
    const memberCount =
      conversation.target.memberCount ?? conversation.group_member_count ?? null;
    return memberCount ? `${memberCount} ${t.members}` : t.groupChat;
  }

  return `${names.slice(0, 6).join(", ")}${names.length > 6 ? ", ..." : ""}`;
}

export function formatContactSubtitle(subtitle: string | null | undefined, t: ChatCopy) {
  if (!subtitle) return "";

  const [rolePart, ...contextParts] = subtitle.split(" - ");
  const normalized = subtitle.trim().toLowerCase();
  const normalizedRole = rolePart.trim().toLowerCase();
  const labels: Record<string, string> = {
    admin: t.admin,
    coach: t.coach,
    player: t.player,
    parent: t.parent,
    head_coach: t.headCoach,
    assistant_coach: t.assistantCoach,
    goalkeeper_coach: t.goalkeeperCoach,
    fitness_coach: t.fitnessCoach,
  };

  if (contextParts.length && labels[normalizedRole]) {
    return `${labels[normalizedRole]} - ${contextParts.join(" - ")}`;
  }

  return labels[normalized] || subtitle.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function contactRoleLabel(type: ContactType, t: ChatCopy) {
  if (type === "admin") return t.admin;
  if (type === "coach") return t.coach;
  if (type === "player") return t.player;
  return t.parent;
}

export function chatErrorMessage(error: unknown, t: ChatCopy, fallback: string) {
  const message = error instanceof Error ? error.message : "";
  if (/cannot contact coaches|can only chat about linked children/i.test(message)) {
    return t.messagingDisabled;
  }
  if (/chat request failed/i.test(message)) return t.requestFailed;
  if (t === chatCopy.en && message) return message;
  return message && !/^[\x00-\x7F]+$/.test(message) ? message : fallback;
}
