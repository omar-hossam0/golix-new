"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Loader2, QrCode, ShieldCheck, UserRound, Users } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ParentManagementRole,
  useGetManagedParentProfileQuery,
} from "@/lib/store/api/calendarApi";

const value = (input: unknown) =>
  input === null || input === undefined || input === "" ? "--" : String(input);

function DetailGrid({ rows }: { rows: Array<[string, unknown]> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map(([label, item]) => (
        <div key={label} className="rounded-lg border border-border/50 bg-muted/10 p-3">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 break-words text-sm font-semibold">{value(item)}</p>
        </div>
      ))}
    </div>
  );
}

export function ParentProfilePage({
  role,
  parentId,
}: {
  role: ParentManagementRole;
  parentId: string;
}) {
  const { data, isLoading, error } = useGetManagedParentProfileQuery({
    role,
    id: parentId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading parent profile...
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Parent profile not found.
        </CardContent>
      </Card>
    );
  }

  const parentName =
    data.parent.name ||
    data.parent.full_name ||
    data.parent.username ||
    data.parent.phone ||
    "Parent account";

  return (
    <div className="space-y-6">
      <PageHeader
        title={parentName}
        description={`${data.links.length} linked player${data.links.length === 1 ? "" : "s"}`}
        breadcrumbs={[
          { label: "Dashboard", href: role === "admin" ? "/admin/dashboard" : "/coach/home" },
          { label: "Parents", href: `/${role}/parents` },
          { label: parentName },
        ]}
        actions={
          <Button variant="outline" asChild>
            <Link href={`/${role}/parents`}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>
        }
      />

      <Card className="border-border/50 bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserRound className="h-4 w-4 text-primary" />
            Parent Data
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DetailGrid
            rows={[
              ["Name", parentName],
              ["Username", data.parent.username],
              ["Phone", data.parent.phone],
              ["Email", data.parent.email],
              ["Address", data.parent.address],
              ["Active", data.parent.is_active],
              ["Linked players", data.parent.linked_players_count],
            ]}
          />
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Parent Links
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-2">
          {data.links.map((link) => (
            <article key={link.id} className="rounded-lg border border-border/50 bg-muted/10 p-4">
              <h3 className="font-bold">{link.player_name}</h3>
              <p className="text-sm text-muted-foreground">
                {link.relation} - {link.group_name || "No group"}
              </p>
              <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                <span>Progress: {link.can_view_progress ? "Yes" : "No"}</span>
                <span>Payments: {link.can_view_payments ? "Yes" : "No"}</span>
                <span>Coach chat: {link.can_message_coach ? "Yes" : "No"}</span>
              </div>
            </article>
          ))}
          {!data.links.length && (
            <p className="rounded-lg border border-dashed border-border/50 p-8 text-center text-muted-foreground lg:col-span-2">
              No linked players.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-primary" />
            Children
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-2">
          {data.children.map((child) => (
            <article key={child.player.id} className="rounded-lg border border-border/50 bg-muted/10 p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h3 className="text-lg font-bold">{child.player.full_name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {value(child.player.player_code)} - {value(child.player.position)} - {value(child.player.group_name)}
                  </p>
                  <DetailGrid
                    rows={[
                      ["Level", child.player.level],
                      ["Date of birth", child.player.date_of_birth],
                      ["Phone", child.player.phone || child.player.account_phone],
                      ["Attendance total", child.summary.attendanceTotals.total],
                      ["Goals", child.summary.matchTotals.goals],
                      ["Assists", child.summary.matchTotals.assists],
                    ]}
                  />
                </div>
                {child.attendanceQr?.qrCodeDataUrl && (
                  <div className="shrink-0 rounded-lg border border-border/50 bg-background/50 p-3 text-center">
                    <QrCode className="mx-auto h-4 w-4 text-primary" />
                    <Image
                      src={child.attendanceQr.qrCodeDataUrl}
                      alt={`${child.player.full_name} QR code`}
                      width={144}
                      height={144}
                      unoptimized
                      className="mt-2 h-36 w-36 rounded-md bg-white p-2"
                    />
                  </div>
                )}
              </div>
            </article>
          ))}
          {!data.children.length && (
            <p className="rounded-lg border border-dashed border-border/50 p-8 text-center text-muted-foreground xl:col-span-2">
              No visible linked children for this parent.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
