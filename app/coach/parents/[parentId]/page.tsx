"use client";

import { use } from "react";
import { ParentProfilePage } from "@/components/parents/ParentProfilePage";

export default function CoachParentProfileRoute({
  params,
}: {
  params: Promise<{ parentId: string }>;
}) {
  const { parentId } = use(params);
  return <ParentProfilePage role="coach" parentId={parentId} />;
}
