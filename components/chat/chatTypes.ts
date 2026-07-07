import { chatCopy } from "@/lib/chatTranslations";

export type ChatCopy = Record<keyof typeof chatCopy.en, string>;

export type ChatRole = "admin" | "coach" | "player" | "parent";
export type ContactType = "admin" | "coach" | "player" | "parent";

export type ConversationType =
  | "admin_coach"
  | "coach_player"
  | "admin_player_session"
  | "parent_coach"
  | "chat_group";

export type Contact = {
  type: ContactType;
  id: string;
  user_id: string;
  player_id?: string | null;
  player_name?: string | null;
  name: string;
  subtitle?: string | null;
};

export type GroupMember = {
  userId: string;
  name: string;
  role: ChatRole;
  membershipRole: "owner" | "member";
};

export type Conversation = {
  id: string;
  type: ConversationType;
  status: "open" | "closed";
  admin_user_id?: string | null;
  coach_user_id?: string | null;
  player_user_id?: string | null;
  parent_user_id?: string | null;
  coach_id?: string | null;
  player_id?: string | null;
  target: {
    type: "admin" | "coach" | "player" | "parent" | "group";
    id?: string | null;
    userId?: string | null;
    name: string;
    memberCount?: number | null;
  };
  context?: {
    playerId: string;
    playerName: string;
  } | null;
  group_member_count?: number | null;
  group_members?: GroupMember[];
  canSend: boolean;
  canClose: boolean;
  last_message_at?: string | null;
  last_message_body?: string | null;
  last_attachment_url?: string | null;
  created_at: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_user_id: string | null;
  sender_name?: string | null;
  sender_role?: string | null;
  body?: string | null;
  attachment_url?: string | null;
  attachment_original_name?: string | null;
  attachment_mime_type?: string | null;
  attachment_size?: number | null;
  created_at: string;
  delivered_at?: string | null;
  edited_at?: string | null;
  read_at?: string | null;
  deleted_at?: string | null;
  deleted_by_user_id?: string | null;
  visibility?: "self" | "everyone";
};

export type ContactsResponse = {
  admins?: Contact[];
  coaches?: Contact[];
  players?: Contact[];
  parents?: Contact[];
  children?: Contact[];
};
