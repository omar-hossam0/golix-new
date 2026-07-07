"use client";

import { useEffect, useMemo, useState } from "react";
import {
  type ParentChild,
  useGetParentChildrenQuery,
} from "@/lib/store/api/calendarApi";

const STORAGE_KEY = "goalix-parent-selected-child-id";
const EVENT_NAME = "goalix-parent-selected-child-change";

export function useParentSelectedChild() {
  const {
    data: children = [],
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useGetParentChildrenQuery();
  const [selectedChildId, setSelectedChildIdState] = useState("");

  useEffect(() => {
    if (!children.length) return;

    const timeout = window.setTimeout(() => {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      const validSaved = saved && children.some((child) => child.id === saved);
      const fallback = children.find((child) => child.is_primary)?.id || children[0]?.id || "";
      setSelectedChildIdState((current) => {
        if (current && children.some((child) => child.id === current)) return current;
        return validSaved ? saved : fallback;
      });
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [children]);

  useEffect(() => {
    const sync = (event: Event) => {
      const custom = event as CustomEvent<{ childId?: string }>;
      if (custom.detail?.childId) {
        setSelectedChildIdState(custom.detail.childId);
      }
    };
    window.addEventListener(EVENT_NAME, sync);
    return () => window.removeEventListener(EVENT_NAME, sync);
  }, []);

  const setSelectedChildId = (childId: string) => {
    setSelectedChildIdState(childId);
    window.localStorage.setItem(STORAGE_KEY, childId);
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { childId } }));
  };

  const selectedChild = useMemo<ParentChild | null>(
    () => children.find((child) => child.id === selectedChildId) || children[0] || null,
    [children, selectedChildId],
  );

  return {
    children,
    isLoading,
    isFetching,
    isError,
    refetch,
    selectedChild,
    selectedChildId: selectedChild?.id || selectedChildId,
    setSelectedChildId,
  };
}
