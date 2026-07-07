import { redirect } from "next/navigation";

export default function LegacyAttendanceSessionsPage() {
  redirect("/admin/calendar");
}
