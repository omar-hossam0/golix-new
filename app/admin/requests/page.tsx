"use client";

import Link from "next/link";
import {
  CheckCircle2,
  Clock,
  KeyRound,
  Loader2,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { RefreshButton } from "@/components/shared/RefreshButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useApproveEvaluationEditRequestMutation,
  useGetAdminEvaluationEditRequestsQuery,
  useRejectEvaluationEditRequestMutation,
  type MatchEvaluationEditRequest,
} from "@/lib/store/api/calendarApi";
import {
  useGetAdminPasswordResetRequestsQuery,
  type PasswordResetRequest,
} from "@/lib/store/api/adminApi";
import { useDashboardLanguage } from "@/lib/hooks/useDashboardLanguage";
import { formatDate, formatTime12 } from "@/lib/utils";

const displayStatus = (request: MatchEvaluationEditRequest) => {
  if (request.status === "approved" && request.consumed_at) return "used";
  return request.status;
};

const statusVariant = (status: string) => {
  if (status === "pending") return "warning" as const;
  if (status === "approved") return "success" as const;
  if (status === "rejected") return "destructive" as const;
  return "secondary" as const;
};

const resetStatusVariant = (status: PasswordResetRequest["status"]) => {
  if (status === "pending") return "warning" as const;
  if (status === "resolved") return "success" as const;
  return "secondary" as const;
};

const resetStatusLabel = (status: PasswordResetRequest["status"]) => {
  if (status === "resolved") return "Password changed";
  if (status === "expired") return "Expired";
  return "Pending";
};

const requestsCopy = {
  en: {
    title: "Requests",
    description: "Coach requests that need admin approval.",
    dashboard: "Dashboard",
    refresh: "Refresh",
    retry: "Retry",
    loadError: "Failed to load requests.",
    emptyTitle: "No requests right now.",
    emptyBody:
      "Evaluation edit requests and player password reset requests will appear here.",
  },
  ar: {
    title: "الطلبات",
    description: "طلبات المدربين التي تحتاج موافقة الإدارة.",
    dashboard: "الرئيسية",
    refresh: "تحديث",
    retry: "إعادة المحاولة",
    loadError: "تعذر تحميل الطلبات.",
    emptyTitle: "لا توجد طلبات الآن.",
    emptyBody: "طلبات تعديل التقييم وطلبات إعادة تعيين كلمة مرور اللاعبين ستظهر هنا.",
  },
} as const;

export default function AdminRequestsPage() {
  const language = useDashboardLanguage();
  const t = requestsCopy[language];
  const { data, isLoading, isError, refetch } =
    useGetAdminEvaluationEditRequestsQuery({ limit: 100 });
  const {
    data: passwordResetRequests = [],
    isLoading: resetsLoading,
    isError: resetsError,
    refetch: refetchResets,
  } = useGetAdminPasswordResetRequestsQuery();
  const [approveRequest, { isLoading: approving }] =
    useApproveEvaluationEditRequestMutation();
  const [rejectRequest, { isLoading: rejecting }] =
    useRejectEvaluationEditRequestMutation();

  const requests = data?.data ?? [];
  const busy = approving || rejecting;
  const hasRequests = requests.length > 0 || passwordResetRequests.length > 0;
  const loading = isLoading || resetsLoading;
  const failed = isError || resetsError;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={t.title}
        description={t.description}
        breadcrumbs={[
          { label: t.dashboard, href: "/admin/dashboard" },
          { label: t.title },
        ]}
        actions={
          <RefreshButton
            size="sm"
            onRefresh={() => Promise.all([refetch(), refetchResets()])}
            label={t.refresh}
          />
        }
      />

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      )}

      {failed && (
        <Card className="border-border/50 bg-card">
          <CardContent className="flex items-center justify-between gap-3 p-5">
            <p className="text-sm text-muted-foreground">{t.loadError}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                refetch();
                refetchResets();
              }}
              className="gap-1.5"
            >
              <RefreshCw className="h-4 w-4" />
              {t.retry}
            </Button>
          </CardContent>
        </Card>
      )}

      {!loading && !failed && !hasRequests && (
        <Card className="border-border/50 bg-card">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <ShieldCheck className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium">{t.emptyTitle}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t.emptyBody}
            </p>
          </CardContent>
        </Card>
      )}

      {!!passwordResetRequests.length && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Password reset requests
            </h2>
          </div>
          {passwordResetRequests.map((request) => (
            <Card key={request.id} className="border-border/50 bg-card">
              <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold">{request.displayName}</h3>
                    <Badge variant={resetStatusVariant(request.status)} className="capitalize">
                      {request.status}
                    </Badge>
                    <Badge variant="outline">{request.role}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                    {request.username && <span>{request.username}</span>}
                    {request.phone && <span>{request.phone}</span>}
                    <span>Requested {new Date(request.createdAt).toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {request.status === "pending" && request.playerId ? (
                    <Button asChild size="sm" className="gap-1.5">
                      <Link href={`/admin/players/${request.playerId}`}>
                        <KeyRound className="h-4 w-4" />
                        Reset Password
                      </Link>
                    </Button>
                  ) : request.status === "pending" && request.coachId ? (
                    <Button asChild size="sm" className="gap-1.5">
                      <Link href={`/admin/coaches/${request.coachId}?resetPassword=1`}>
                        <KeyRound className="h-4 w-4" />
                        Reset Password
                      </Link>
                    </Button>
                  ) : (
                    <Badge variant={resetStatusVariant(request.status)} className="gap-1.5">
                      {request.status === "resolved" ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : (
                        <Clock className="h-3.5 w-3.5" />
                      )}
                      {resetStatusLabel(request.status)}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {!!requests.length && (
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Evaluation edit requests
            </h2>
          </div>
        )}
        {requests.map((request) => {
          const status = displayStatus(request);
          const pending = request.status === "pending";

          return (
            <Card key={request.id} className="border-border/50 bg-card">
              <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold">
                      {request.opponent_name ?? "Match evaluation"}
                    </h3>
                    <Badge variant={statusVariant(status)} className="capitalize">
                      {status}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                    <span>{request.coach_name ?? "Coach"}</span>
                    {request.match_date && (
                      <span>
                        {formatDate(request.match_date)}
                        {request.match_time ? ` at ${formatTime12(request.match_time)}` : ""}
                      </span>
                    )}
                    {request.expires_at && status === "approved" && (
                      <span>Open until {new Date(request.expires_at).toLocaleString()}</span>
                    )}
                  </div>
                  {request.reason && (
                    <p className="text-sm text-muted-foreground">{request.reason}</p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {request.match_id && (
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/admin/matches?matchId=${request.match_id}`}>
                        View Match
                      </Link>
                    </Button>
                  )}
                  {pending ? (
                    <>
                      <Button
                        size="sm"
                        className="gap-1.5"
                        disabled={busy}
                        onClick={() => approveRequest({ id: request.id })}
                      >
                        {approving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        disabled={busy}
                        onClick={() => rejectRequest({ id: request.id })}
                      >
                        {rejecting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <XCircle className="h-4 w-4" />
                        )}
                        Reject
                      </Button>
                    </>
                  ) : (
                    <Badge variant="outline" className="gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      {new Date(request.updated_at).toLocaleString()}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
