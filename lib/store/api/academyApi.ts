import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import {
  mockBranches,
  mockBirthYears,
  mockGroups,
  mockCoaches,
  mockPlayers,
  mockParents,
  mockSessions,
  mockAttendanceRecords,
  mockEvaluations,
  mockMeasurements,
  mockRankings,
  mockSubscriptions,
  mockInvoices,
  mockNotifications,
  mockActivityFeed,
  mockAdminKPIs,
  mockAttendanceChartData,
  mockRevenueChartData,
  mockUsers,
} from "@/lib/mock-data";

// Simulate network delay
const delay = (ms: number = 300) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const academyApi = createApi({
  reducerPath: "academyApi",
  baseQuery: fakeBaseQuery(),
  keepUnusedDataFor: 300,
  tagTypes: [
    "Branch",
    "BirthYear",
    "Group",
    "Coach",
    "Player",
    "Parent",
    "Session",
    "Attendance",
    "Evaluation",
    "Measurement",
    "Ranking",
    "Subscription",
    "Invoice",
    "Notification",
    "User",
  ],
  endpoints: (builder) => ({
    // ─── Users ─────────────────────────────────────────
    getUsers: builder.query({
      queryFn: async () => {
        await delay();
        return { data: mockUsers };
      },
      providesTags: ["User"],
    }),

    // ─── Branches ──────────────────────────────────────
    getBranches: builder.query({
      queryFn: async () => {
        await delay();
        return { data: mockBranches };
      },
      providesTags: ["Branch"],
    }),
    getBranch: builder.query({
      queryFn: async (id: string) => {
        await delay();
        const branch = mockBranches.find((b) => b.id === id);
        return branch ? { data: branch } : { error: { message: "Not found" } };
      },
      providesTags: (_result, _error, id) => [{ type: "Branch", id }],
    }),

    // ─── Birth Years ───────────────────────────────────
    getBirthYears: builder.query({
      queryFn: async () => {
        await delay();
        return { data: mockBirthYears };
      },
      providesTags: ["BirthYear"],
    }),

    // ─── Groups ────────────────────────────────────────
    getGroups: builder.query({
      queryFn: async () => {
        await delay();
        return { data: mockGroups };
      },
      providesTags: ["Group"],
    }),
    getGroupsByBranch: builder.query({
      queryFn: async (branchId: string) => {
        await delay();
        return {
          data: mockGroups.filter((g) => g.branchId === branchId),
        };
      },
      providesTags: ["Group"],
    }),

    // ─── Coaches ───────────────────────────────────────
    getCoaches: builder.query({
      queryFn: async () => {
        await delay();
        return { data: mockCoaches };
      },
      providesTags: ["Coach"],
    }),
    getCoach: builder.query({
      queryFn: async (id: string) => {
        await delay();
        const coach = mockCoaches.find((c) => c.id === id);
        return coach ? { data: coach } : { error: { message: "Not found" } };
      },
      providesTags: (_result, _error, id) => [{ type: "Coach", id }],
    }),

    // ─── Players ───────────────────────────────────────
    getPlayers: builder.query({
      queryFn: async () => {
        await delay();
        return { data: mockPlayers };
      },
      providesTags: ["Player"],
    }),
    getPlayer: builder.query({
      queryFn: async (id: string) => {
        await delay();
        const player = mockPlayers.find((p) => p.id === id);
        return player
          ? { data: player }
          : { error: { message: "Not found" } };
      },
      providesTags: (_result, _error, id) => [{ type: "Player", id }],
    }),
    getPlayersByGroup: builder.query({
      queryFn: async (groupId: string) => {
        await delay();
        return {
          data: mockPlayers.filter((p) => p.groupId === groupId),
        };
      },
      providesTags: ["Player"],
    }),
    getPlayersByBranch: builder.query({
      queryFn: async (branchId: string) => {
        await delay();
        return {
          data: mockPlayers.filter((p) => p.branchId === branchId),
        };
      },
      providesTags: ["Player"],
    }),

    // ─── Parents ───────────────────────────────────────
    getParents: builder.query({
      queryFn: async () => {
        await delay();
        return { data: mockParents };
      },
      providesTags: ["Parent"],
    }),

    // ─── Sessions ──────────────────────────────────────
    getSessions: builder.query({
      queryFn: async () => {
        await delay();
        return { data: mockSessions };
      },
      providesTags: ["Session"],
    }),
    getSessionsByCoach: builder.query({
      queryFn: async (coachId: string) => {
        await delay();
        return {
          data: mockSessions.filter((s) => s.coachId === coachId),
        };
      },
      providesTags: ["Session"],
    }),

    // ─── Attendance ────────────────────────────────────
    getAttendanceRecords: builder.query({
      queryFn: async () => {
        await delay();
        return { data: mockAttendanceRecords };
      },
      providesTags: ["Attendance"],
    }),
    getAttendanceBySession: builder.query({
      queryFn: async (sessionId: string) => {
        await delay();
        return {
          data: mockAttendanceRecords.filter(
            (a) => a.sessionId === sessionId
          ),
        };
      },
      providesTags: ["Attendance"],
    }),
    getAttendanceByPlayer: builder.query({
      queryFn: async (playerId: string) => {
        await delay();
        return {
          data: mockAttendanceRecords.filter(
            (a) => a.playerId === playerId
          ),
        };
      },
      providesTags: ["Attendance"],
    }),

    // ─── Evaluations ──────────────────────────────────
    getEvaluations: builder.query({
      queryFn: async () => {
        await delay();
        return { data: mockEvaluations };
      },
      providesTags: ["Evaluation"],
    }),
    getEvaluationsByPlayer: builder.query({
      queryFn: async (playerId: string) => {
        await delay();
        return {
          data: mockEvaluations.filter((e) => e.playerId === playerId),
        };
      },
      providesTags: ["Evaluation"],
    }),

    // ─── Measurements ─────────────────────────────────
    getMeasurements: builder.query({
      queryFn: async () => {
        await delay();
        return { data: mockMeasurements };
      },
      providesTags: ["Measurement"],
    }),
    getMeasurementsByPlayer: builder.query({
      queryFn: async (playerId: string) => {
        await delay();
        return {
          data: mockMeasurements.filter((m) => m.playerId === playerId),
        };
      },
      providesTags: ["Measurement"],
    }),

    // ─── Rankings ──────────────────────────────────────
    getRankings: builder.query({
      queryFn: async () => {
        await delay();
        return { data: mockRankings };
      },
      providesTags: ["Ranking"],
    }),
    getRankingsByGroup: builder.query({
      queryFn: async (groupId: string) => {
        await delay();
        return {
          data: mockRankings.filter((r) => r.groupId === groupId),
        };
      },
      providesTags: ["Ranking"],
    }),

    // ─── Subscriptions ────────────────────────────────
    getSubscriptions: builder.query({
      queryFn: async () => {
        await delay();
        return { data: mockSubscriptions };
      },
      providesTags: ["Subscription"],
    }),

    // ─── Invoices ──────────────────────────────────────
    getInvoices: builder.query({
      queryFn: async () => {
        await delay();
        return { data: mockInvoices };
      },
      providesTags: ["Invoice"],
    }),

    // ─── Notifications ────────────────────────────────
    getNotifications: builder.query({
      queryFn: async () => {
        await delay();
        return { data: mockNotifications };
      },
      providesTags: ["Notification"],
    }),

    // ─── Dashboard / Analytics ────────────────────────
    getAdminKPIs: builder.query({
      queryFn: async () => {
        await delay();
        return { data: mockAdminKPIs };
      },
    }),
    getActivityFeed: builder.query({
      queryFn: async () => {
        await delay();
        return { data: mockActivityFeed };
      },
    }),
    getAttendanceChart: builder.query({
      queryFn: async () => {
        await delay();
        return { data: mockAttendanceChartData };
      },
    }),
    getRevenueChart: builder.query({
      queryFn: async () => {
        await delay();
        return { data: mockRevenueChartData };
      },
    }),
  }),
});

export const {
  useGetUsersQuery,
  useGetBranchesQuery,
  useGetBranchQuery,
  useGetBirthYearsQuery,
  useGetGroupsQuery,
  useGetGroupsByBranchQuery,
  useGetCoachesQuery,
  useGetCoachQuery,
  useGetPlayersQuery,
  useGetPlayerQuery,
  useGetPlayersByGroupQuery,
  useGetPlayersByBranchQuery,
  useGetParentsQuery,
  useGetSessionsQuery,
  useGetSessionsByCoachQuery,
  useGetAttendanceRecordsQuery,
  useGetAttendanceBySessionQuery,
  useGetAttendanceByPlayerQuery,
  useGetEvaluationsQuery,
  useGetEvaluationsByPlayerQuery,
  useGetMeasurementsQuery,
  useGetMeasurementsByPlayerQuery,
  useGetRankingsQuery,
  useGetRankingsByGroupQuery,
  useGetSubscriptionsQuery,
  useGetInvoicesQuery,
  useGetNotificationsQuery,
  useGetAdminKPIsQuery,
  useGetActivityFeedQuery,
  useGetAttendanceChartQuery,
  useGetRevenueChartQuery,
} = academyApi;
