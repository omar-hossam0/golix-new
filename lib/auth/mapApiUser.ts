import type { UserRole } from "@/lib/types";

type ApiUserRecord = Record<string, unknown>;

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asNullableString(value: unknown) {
  return typeof value === "string" ? value : null;
}

export function mapApiUser(apiUser: ApiUserRecord) {
  const username = asString(apiUser.username) || undefined;
  const email = asString(apiUser.email);
  const fullName =
    asString(apiUser.full_name) ||
    asString(apiUser.fullName) ||
    username ||
    email;

  return {
    id: asString(apiUser.id),
    email,
    username,
    fullName,
    role: asString(apiUser.role) as UserRole,
    avatarUrl: asString(apiUser.avatar_url),
    phone: asString(apiUser.phone),
    linkedPlayerId:
      asNullableString(apiUser.linkedPlayerId) ??
      asNullableString(apiUser.linked_player_id) ??
      null,
    createdAt: asString(apiUser.created_at) || new Date().toISOString(),
  };
}
