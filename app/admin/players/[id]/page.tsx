"use client";

import { use } from "react";
import { ManagedPlayerDetailPage } from "@/app/coach/players/[playerId]/page";

export default function AdminPlayerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <ManagedPlayerDetailPage role="admin" playerId={id} />;
}
