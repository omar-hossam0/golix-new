"use client";

import { use } from "react";
import { ParentProfilePage } from "@/components/parents/ParentProfilePage";

export default function AdminParentProfileRoute({
  params,
}: {
  params: Promise<{ parentId: string }>;
}) {
  const { parentId } = use(params);
  return <ParentProfilePage role="admin" parentId={parentId} />;
}
