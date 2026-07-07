"use client";

import { useCallback } from "react";
import {
  type CoachPermission,
  useGetCoachPermissionsQuery,
} from "@/lib/store/api/calendarApi";

export function useCoachPermissions(options?: { skip?: boolean }) {
  const query = useGetCoachPermissionsQuery(undefined, {
    skip: options?.skip,
  });

  const can = useCallback(
    (permission: CoachPermission) => query.data?.[permission] === true,
    [query.data],
  );

  const canAny = useCallback(
    (permissions: CoachPermission[]) =>
      permissions.some((permission) => query.data?.[permission] === true),
    [query.data],
  );

  return {
    ...query,
    permissions: query.data,
    can,
    canAny,
  };
}
