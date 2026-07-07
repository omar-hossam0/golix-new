import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithReauth } from "./baseQuery";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DashboardKPIs {
    totalPlayers: number;
    totalCoaches: number;
    activeSubscriptions: number;
    overduePayments: number;
    monthlyRevenue: number;
    avgAttendanceRate: number;
}

export interface ChartPoint {
    label: string;
    value: number;
}

export interface TopPlayer {
    id: string;
    fullName: string;
    totalScore: number | string;
    rank: number;
    period: string;
}

export interface RecentAlert {
    id: string;
    title: string;
    body: string;
    type: string;
    isRead: boolean;
    createdAt: string;
}

export interface WeeklyMatch {
    id: string;
    opponentName: string;
    matchTime: string | null;
    venueType: string | null;
    status: string | null;
    matchStatus: string | null;
    ourScore: number | null;
    opponentScore: number | null;
    played: boolean;
}

export interface WeeklyMatchDay {
    date: string;
    dayLabel: string;
    dateLabel: string;
    matches: WeeklyMatch[];
}

export interface DashboardData {
    kpis: DashboardKPIs;
    attendanceTrend: ChartPoint[];
    revenueTrend: ChartPoint[];
    topPlayers: TopPlayer[];
    recentAlerts: RecentAlert[];
    weeklyMatches: WeeklyMatchDay[];
}

export interface PlayerListItem {
    id: string;
    full_name: string;
    level: string | null;
    position: string | null;
    photo_url: string | null;
    created_at: string;
}

export interface ReportsOverview {
    filters: {
        branchId: string | null;
        dateFrom: string;
        dateTo: string;
    };
    summary: {
        totalPlayers: number;
        activePlayers: number;
        newPlayers: number;
        totalCoaches: number;
        totalSessions: number;
        completedSessions: number;
        attendanceRate: number;
    };
    attendance: {
        total: number;
        present: number;
        late: number;
        absent: number;
        excused: number;
        injured: number;
    };
    levelDistribution: Array<{ level: string; count: number }>;
    attendanceTrend: Array<{ label: string; rate: number }>;
    groups: Array<{
        id: string;
        name: string;
        branchName: string;
        players: number;
        sessions: number;
        attendanceRate: number;
    }>;
    coaches: Array<{
        id: string;
        name: string;
        specialization: string | null;
        role: string | null;
        branchName: string | null;
        groupCount: number;
        playerCount: number;
        sessions: number;
        attendanceRate: number;
    }>;
    players: Array<{
        id: string;
        fullName: string;
        playerCode: string | null;
        level: "A" | "B" | "C" | "D" | "F" | null;
        position: string | null;
        preferredFoot: string | null;
        profileStatus: "complete" | "incomplete" | null;
        isActive: boolean;
        dateJoined: string | null;
        branchName: string | null;
        groupName: string | null;
        measuredAt: string | null;
        heightCm: number | null;
        weightKg: number | null;
        sprintSpeed: number | null;
        stamina: number | null;
        attendanceTotal: number;
        attendanceAttended: number;
        attendanceRate: number;
    }>;
}

export interface ReportsOverviewFilters {
    branchId?: string;
    dateFrom?: string;
    dateTo?: string;
}

// ─── API ─────────────────────────────────────────────────────────────────────

export const dashboardApi = createApi({
    reducerPath: "dashboardApi",
    baseQuery: baseQueryWithReauth,
    keepUnusedDataFor: 300,
    tagTypes: ["Dashboard", "Players"],
    endpoints: (builder) => ({
        getDashboard: builder.query<DashboardData, void>({
            query: () => "/admin/dashboard",
            transformResponse: (res: { data: DashboardData }) => res.data,
            providesTags: ["Dashboard"],
        }),
        getRecentPlayers: builder.query<PlayerListItem[], void>({
            query: () => "/players?limit=6",
            transformResponse: (res: { data: PlayerListItem[] }) => res.data,
            providesTags: ["Players"],
        }),
        getReportsOverview: builder.query<ReportsOverview, ReportsOverviewFilters>({
            query: (filters) => ({
                url: "/admin/reports/overview",
                params: filters,
            }),
            transformResponse: (res: { data: ReportsOverview }) => res.data,
            providesTags: ["Dashboard"],
        }),
    }),
});

export const {
    useGetDashboardQuery,
    useGetRecentPlayersQuery,
    useGetReportsOverviewQuery,
} = dashboardApi;
