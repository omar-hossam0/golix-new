import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithReauth } from "./baseQuery";

export interface CoachGroup {
  id: string;
  branchId: string;
  branchName: string;
  birthYears: Array<{
    id: string;
    label: string;
    fromYear: number;
    toYear: number;
    createdByRole?: "admin" | "coach";
    createdByUserId?: string | null;
    createdByCoachId?: string | null;
    createdByName?: string | null;
    canDelete?: boolean;
  }>;
  name: string;
  role: string;
  maxPlayers: number;
  playerCount: number;
  schedule: string;
  status: "active" | "inactive";
  avgAttendance: number;
  avgPerformance: number;
  assignedAt: string;
}

export interface CreateCoachGroupInput {
  branchId: string;
  birthYearId: string;
  name: string;
  maxPlayers?: number;
  playerIds?: string[];
}

export interface UpdateCoachGroupInput {
  groupId: string;
  body: {
    birthYearIds?: string[];
    birthYearId?: string;
    name?: string;
    maxPlayers?: number;
    playerIds?: string[];
  };
}

export interface CreateCoachBirthYearInput {
  branchId: string;
  fromYear: number;
  toYear: number;
  label?: string;
}

export interface CoachPlayer {
  id: string;
  userId: string | null;
  fullName: string;
  dateOfBirth: string | null;
  age: number;
  level: string;
  position: string;
  mainPosition?: string;
  rawPosition?: string | null;
  preferredFoot: string | null;
  avatarUrl: string;
  branchId: string;
  branchName: string;
  groupId: string;
  groupName: string;
  parentName: string;
  parentPhone: string;
  height: number;
  weight: number;
  sprintSpeed: number;
  stamina?: number;
  flexibility: number;
  measurementNotes: string;
  attendanceRate: number;
  performanceScore: number;
  rankInGroup: number;
  trend: "improving" | "stable" | "declining";
  profileStatus: "incomplete" | "complete";
  status: "active" | "inactive" | "injured";
}

export interface CoachSession {
  id: string;
  groupId: string;
  groupName: string;
  coachId: string | null;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  type: "training" | "match" | "assessment" | "sports_day";
  status: "scheduled" | "active" | "completed" | "cancelled";
  notes: string;
  attendanceCount: number;
  totalPlayers: number;
}

export interface CoachAttendanceRecord {
  id: string;
  sessionId: string;
  playerId: string;
  playerName: string;
  status: "present" | "absent" | "late" | "excused";
  notes: string;
  markedBy: string | null;
  markedAt: string;
  session_date?: string;
  session_type?: string;
  group_name?: string;
}

export interface CoachEvaluation {
  id: string;
  playerId: string;
  playerName: string;
  groupId: string | null;
  groupName: string | null;
  coachId: string;
  date: string;
  technicalScore: number;
  tacticalScore: number;
  physicalScore: number;
  mentalScore: number;
  overallScore: number;
  notes: string;
}

export interface Pagination {
  total: number;
  page: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: Pagination;
}

type ApiListResponse<T> = {
  data: T[];
  meta?: { pagination?: Pagination };
  pagination?: Pagination;
};

const toPaginated = <T>(res: ApiListResponse<T>): PaginatedResponse<T> => ({
  data: res.data,
  pagination: res.pagination ??
    res.meta?.pagination ?? {
      total: res.data.length,
      page: 1,
      totalPages: 1,
    },
});

export interface CoachDashboard {
  coach: {
    id: string;
    fullName: string;
    specialization: string | null;
  };
  stats: {
    groups: number;
    players: number;
    avgAttendance: number;
    evaluations: number;
  };
  groups: CoachGroup[];
  sessions: CoachSession[];
  evaluations: CoachEvaluation[];
  notifications: { id: string; title: string; message: string; type: string }[];
}

export interface CoachAccessStatus {
  hasAssignments: boolean;
  ruleCount: number;
  groupCount: number;
}

export interface CoachManageBranch {
  id: string;
  name: string;
}

export interface CoachBirthday {
  id: string;
  branchId: string;
  branchName: string;
  label: string;
  normalizedLabel: string;
  fromYear: number;
  toYear: number;
  accessType: "groups" | "birth_years";
  groupCount: number;
  playerCount: number;
  createdByRole?: "admin" | "coach";
  createdByUserId?: string | null;
  createdByCoachId?: string | null;
  createdByName?: string | null;
  canDelete?: boolean;
}

export interface CoachGroupDetail {
  group: CoachGroup;
  players: CoachPlayer[];
}

export interface CoachGroupDetailInput {
  groupId: string;
  month?: string;
}

export interface CoachSessionDetail {
  session: CoachSession;
  records: CoachAttendanceRecord[];
}

export interface MarkAttendanceInput {
  sessionId: string;
  records: {
    playerId: string;
    status: "present" | "absent" | "late" | "excused";
    notes?: string;
  }[];
}

export interface MeasurementInput {
  records: {
    playerId: string;
    heightCm?: number;
    weightKg?: number;
    sprintSpeed?: number;
    stamina?: number;
    flexibility?: number;
    notes?: string;
    measuredAt?: string;
  }[];
}

export interface CreateEvaluationInput {
  playerId: string;
  groupId?: string;
  technicalScore: number;
  tacticalScore: number;
  physicalScore: number;
  mentalScore: number;
  notes?: string;
}

export interface CoachAssignmentFile {
  id: string;
  assignmentId: string;
  fileRole: "brief" | "submission";
  fileType: "pdf" | "word" | "image";
  fileName: string;
  fileUrl: string;
  mimeType: string | null;
  sizeBytes: number;
  uploadedBy: string | null;
  createdAt: string;
}

export interface CoachAssignment {
  id: string;
  coachId: string;
  coachName: string | null;
  branchId: string | null;
  branchName: string | null;
  groupId: string | null;
  groupName: string | null;
  title: string;
  description: string;
  dueDate: string | null;
  status: "assigned" | "in_progress" | "submitted" | "reviewed" | "cancelled";
  assignedAt: string;
  submittedAt: string | null;
  adminNotes: string;
  coachNotes: string;
  attachments: CoachAssignmentFile[];
  submissions: CoachAssignmentFile[];
}

export interface SubmitAssignmentInput {
  assignmentId: string;
  coachNotes?: string;
  files: {
    fileType: "pdf" | "word" | "image";
    fileName: string;
    fileUrl: string;
    mimeType?: string;
    sizeBytes?: number;
  }[];
}

export type UploadedAssignmentFile = SubmitAssignmentInput["files"][number];

export interface PlayerAssignmentGroup {
  id: string;
  name: string;
}

export interface PlayerAssignmentFile {
  id: string;
  submissionId: string;
  fileType: "pdf" | "word" | "image";
  fileName: string;
  fileUrl: string;
  mimeType: string | null;
  sizeBytes: number;
  uploadedBy: string | null;
  createdAt: string;
}

export interface PlayerAssignmentSubmission {
  id: string;
  assignmentId: string;
  playerId: string;
  playerName: string | null;
  notes: string;
  submittedAt: string;
  reviewStatus: "pending" | "approved" | "rejected";
  coachComment: string;
  reviewedAt: string | null;
  files: PlayerAssignmentFile[];
}

export interface CoachPlayerAssignment {
  id: string;
  academyId: string;
  createdByCoachId: string;
  coachName: string | null;
  title: string;
  description: string;
  openAt: string | null;
  dueAt: string | null;
  targetType: "group" | "birth_year";
  status: "active" | "closed" | "cancelled";
  acceptedFileTypes: Array<"pdf" | "word" | "image">;
  createdAt: string;
  updatedAt: string;
  groups: PlayerAssignmentGroup[];
  birthYears: Array<{ id: string; label: string; fromYear: number; toYear: number }>;
  submissionCount: number;
  submissions: PlayerAssignmentSubmission[];
}

export interface PlayerAssignmentInput {
  title: string;
  description?: string;
  openAt?: string;
  dueAt?: string;
  targetType?: "group" | "birth_year";
  groupIds: string[];
  birthYearIds?: string[];
}

export interface UpdatePlayerAssignmentInput {
  assignmentId: string;
  body: Partial<PlayerAssignmentInput> & {
    status?: "active" | "closed" | "cancelled";
  };
}

export interface ReviewPlayerAssignmentSubmissionInput {
  assignmentId: string;
  submissionId: string;
  status: "approved" | "rejected";
  comment?: string;
}

export interface CoachDailyAiInput {
  id: string;
  playerId: string;
  playerName: string;
  inputDate: string;
  sleepHours: number;
  trainedToday: number;
  mealsCount: number;
  dailyAiScore: number;
  submittedAt: string;
}

export interface CoachDailyAiSummary {
  weekStart: string;
  weekEnd: string;
  data: CoachDailyAiInput[];
}

export const coachApi = createApi({
  reducerPath: "coachApi",
  baseQuery: baseQueryWithReauth,
  keepUnusedDataFor: 300,
  tagTypes: [
    "CoachDashboard",
    "CoachGroups",
    "CoachBirthdays",
    "CoachAccess",
    "CoachSessions",
    "CoachAttendance",
    "CoachMeasurements",
    "CoachEvaluations",
    "CoachAssignments",
    "PlayerAssignments",
    "DailyAiInputs",
  ],
  endpoints: (builder) => ({
    getCoachAccessStatus: builder.query<CoachAccessStatus, void>({
      query: () => "/coaches/me/access-status",
      transformResponse: (res: { data: CoachAccessStatus }) => res.data,
      providesTags: ["CoachAccess"],
    }),
    getCoachManageBranches: builder.query<CoachManageBranch[], void>({
      query: () => "/coaches/me/manage-branches",
      transformResponse: (res: { data: CoachManageBranch[] }) => res.data,
      providesTags: ["CoachAccess"],
    }),
    getCoachBirthdays: builder.query<CoachBirthday[], void>({
      query: () => "/coaches/me/birthdays",
      transformResponse: (res: { data: CoachBirthday[] }) => res.data,
      providesTags: ["CoachBirthdays", "CoachAccess"],
    }),
    getCoachDashboard: builder.query<CoachDashboard, void>({
      query: () => "/coaches/me/dashboard",
      transformResponse: (res: { data: CoachDashboard }) => res.data,
      providesTags: ["CoachDashboard"],
    }),
    getCoachGroups: builder.query<CoachGroup[], void>({
      query: () => "/coaches/me/groups",
      transformResponse: (res: { data: CoachGroup[] }) => res.data,
      providesTags: ["CoachGroups"],
    }),
    getCoachGroup: builder.query<CoachGroupDetail, CoachGroupDetailInput>({
      query: ({ groupId, month }) => {
        const params = new URLSearchParams();
        if (month) params.set("month", month);
        const query = params.toString();
        return `/coaches/me/groups/${groupId}${query ? `?${query}` : ""}`;
      },
      transformResponse: (res: { data: CoachGroupDetail }) => res.data,
      providesTags: ["CoachGroups"],
    }),
    createCoachGroup: builder.mutation<CoachGroup, CreateCoachGroupInput>({
      query: (body) => ({ url: "/coaches/me/groups", method: "POST", body }),
      transformResponse: (res: { data: CoachGroup }) => res.data,
      invalidatesTags: ["CoachGroups", "CoachDashboard"],
    }),
    updateCoachGroup: builder.mutation<CoachGroupDetail, UpdateCoachGroupInput>(
      {
        query: ({ groupId, body }) => ({
          url: `/coaches/me/groups/${groupId}`,
          method: "PATCH",
          body,
        }),
        transformResponse: (res: { data: CoachGroupDetail }) => res.data,
        invalidatesTags: ["CoachGroups", "CoachDashboard"],
      },
    ),
    deleteCoachGroup: builder.mutation<{ message: string }, string>({
      query: (groupId) => ({
        url: `/coaches/me/groups/${groupId}`,
        method: "DELETE",
      }),
      transformResponse: (res: { data: { message: string } }) => res.data,
      invalidatesTags: ["CoachGroups", "CoachDashboard"],
    }),
    createCoachBirthYear: builder.mutation<
      {
        id: string;
        branch_id: string;
        from_year: number;
        to_year: number;
        label: string | null;
        created_by_role?: "admin" | "coach";
        created_by_user_id?: string | null;
        created_by_coach_id?: string | null;
      },
      CreateCoachBirthYearInput
    >({
      query: (body) => ({
        url: "/coaches/me/birth-years",
        method: "POST",
        body,
      }),
      transformResponse: (res: {
        data: {
          id: string;
          branch_id: string;
          from_year: number;
          to_year: number;
          label: string | null;
          created_by_role?: "admin" | "coach";
          created_by_user_id?: string | null;
          created_by_coach_id?: string | null;
        };
      }) => res.data,
      invalidatesTags: ["CoachBirthdays", "CoachAccess"],
    }),
    deleteCoachBirthYear: builder.mutation<{ message: string }, string>({
      query: (birthYearId) => ({
        url: `/coaches/me/birth-years/${birthYearId}`,
        method: "DELETE",
      }),
      transformResponse: (res: { data: { message: string } }) => res.data,
      invalidatesTags: ["CoachBirthdays", "CoachAccess", "CoachGroups", "CoachDashboard"],
    }),
    getCoachSessions: builder.query<
      PaginatedResponse<CoachSession>,
      {
        groupId?: string;
        status?: string;
        page?: number;
        limit?: number;
      } | void
    >({
      query: (args) => {
        const params = new URLSearchParams({
          page: String(args?.page ?? 1),
          limit: String(args?.limit ?? 100),
        });
        if (args?.groupId) params.set("groupId", args.groupId);
        if (args?.status) params.set("status", args.status);
        return `/coaches/me/sessions?${params}`;
      },
      transformResponse: (res: ApiListResponse<CoachSession>) =>
        toPaginated(res),
      providesTags: ["CoachSessions"],
    }),
    getCoachSession: builder.query<CoachSessionDetail, string>({
      query: (sessionId) => `/coaches/me/sessions/${sessionId}`,
      transformResponse: (res: { data: CoachSessionDetail }) => res.data,
      providesTags: ["CoachSessions", "CoachAttendance"],
    }),
    markCoachAttendance: builder.mutation<
      CoachAttendanceRecord[],
      MarkAttendanceInput
    >({
      query: ({ sessionId, records }) => ({
        url: `/coaches/me/sessions/${sessionId}/attendance`,
        method: "PATCH",
        body: { records },
      }),
      transformResponse: (res: { data: CoachAttendanceRecord[] }) => res.data,
      invalidatesTags: ["CoachAttendance", "CoachSessions", "CoachDashboard"],
    }),
    getCoachAttendanceHistory: builder.query<
      PaginatedResponse<CoachAttendanceRecord>,
      { page?: number; limit?: number } | void
    >({
      query: (args) =>
        `/coaches/me/attendance-history?page=${args?.page ?? 1}&limit=${args?.limit ?? 100}`,
      transformResponse: (res: ApiListResponse<CoachAttendanceRecord>) =>
        toPaginated(res),
      providesTags: ["CoachAttendance"],
    }),
    saveCoachMeasurements: builder.mutation<unknown, MeasurementInput>({
      query: (body) => ({
        url: "/coaches/me/measurements",
        method: "POST",
        body,
      }),
      invalidatesTags: ["CoachMeasurements", "CoachGroups", "CoachDashboard"],
    }),
    getCoachEvaluations: builder.query<
      PaginatedResponse<CoachEvaluation>,
      { page?: number; limit?: number } | void
    >({
      query: (args) =>
        `/coaches/me/evaluations?page=${args?.page ?? 1}&limit=${args?.limit ?? 100}`,
      transformResponse: (res: ApiListResponse<CoachEvaluation>) =>
        toPaginated(res),
      providesTags: ["CoachEvaluations"],
    }),
    createCoachEvaluation: builder.mutation<unknown, CreateEvaluationInput>({
      query: (body) => ({
        url: "/coaches/me/evaluations",
        method: "POST",
        body,
      }),
      invalidatesTags: ["CoachEvaluations", "CoachGroups", "CoachDashboard"],
    }),
    getMyCoachAssignments: builder.query<
      PaginatedResponse<CoachAssignment>,
      { status?: string; page?: number; limit?: number } | void
    >({
      query: (args) => {
        const params = new URLSearchParams({
          page: String(args?.page ?? 1),
          limit: String(args?.limit ?? 50),
        });
        if (args?.status) params.set("status", args.status);
        return `/coaches/me/assignments?${params}`;
      },
      transformResponse: (res: ApiListResponse<CoachAssignment>) =>
        toPaginated(res),
      providesTags: ["CoachAssignments"],
    }),
    submitCoachAssignment: builder.mutation<
      CoachAssignment,
      SubmitAssignmentInput
    >({
      query: ({ assignmentId, ...body }) => ({
        url: `/coaches/me/assignments/${assignmentId}/submit`,
        method: "POST",
        body,
      }),
      transformResponse: (res: { data: CoachAssignment }) => res.data,
      invalidatesTags: ["CoachAssignments", "CoachDashboard"],
    }),
    uploadCoachAssignmentFile: builder.mutation<UploadedAssignmentFile, File>({
      query: (file) => ({
        url: "/coaches/assignments/upload",
        method: "POST",
        body: file,
        headers: {
          "Content-Type": file.type || "application/octet-stream",
          "X-File-Name": encodeURIComponent(file.name || "assignment-file"),
        },
      }),
      transformResponse: (res: { data: UploadedAssignmentFile }) => res.data,
    }),
    getMyPlayerAssignments: builder.query<
      PaginatedResponse<CoachPlayerAssignment>,
      { status?: "active" | "closed" | "cancelled"; page?: number; limit?: number } | void
    >({
      query: (args) => {
        const params = new URLSearchParams({
          page: String(args?.page ?? 1),
          limit: String(args?.limit ?? 50),
        });
        if (args?.status) params.set("status", args.status);
        return `/coaches/me/player-assignments?${params}`;
      },
      transformResponse: (res: ApiListResponse<CoachPlayerAssignment>) =>
        toPaginated(res),
      providesTags: ["PlayerAssignments"],
    }),
    createMyPlayerAssignment: builder.mutation<
      CoachPlayerAssignment,
      PlayerAssignmentInput
    >({
      query: (body) => ({
        url: "/coaches/me/player-assignments",
        method: "POST",
        body,
      }),
      transformResponse: (res: { data: CoachPlayerAssignment }) => res.data,
      invalidatesTags: ["PlayerAssignments"],
    }),
    updateMyPlayerAssignment: builder.mutation<
      CoachPlayerAssignment,
      UpdatePlayerAssignmentInput
    >({
      query: ({ assignmentId, body }) => ({
        url: `/coaches/me/player-assignments/${assignmentId}`,
        method: "PATCH",
        body,
      }),
      transformResponse: (res: { data: CoachPlayerAssignment }) => res.data,
      invalidatesTags: ["PlayerAssignments"],
    }),
    deleteMyPlayerAssignment: builder.mutation<
      { id: string; deleted: boolean },
      string
    >({
      query: (assignmentId) => ({
        url: `/coaches/me/player-assignments/${assignmentId}`,
        method: "DELETE",
      }),
      transformResponse: (res: { data: { id: string; deleted: boolean } }) => res.data,
      invalidatesTags: ["PlayerAssignments"],
    }),
    getPlayerAssignmentSubmissions: builder.query<
      PlayerAssignmentSubmission[],
      string
    >({
      query: (assignmentId) =>
        `/coaches/me/player-assignments/${assignmentId}/submissions`,
      transformResponse: (res: { data: PlayerAssignmentSubmission[] }) =>
        res.data,
      providesTags: ["PlayerAssignments"],
    }),
    reviewPlayerAssignmentSubmission: builder.mutation<
      PlayerAssignmentSubmission,
      ReviewPlayerAssignmentSubmissionInput
    >({
      query: ({ assignmentId, submissionId, status, comment }) => ({
        url: `/coaches/me/player-assignments/${assignmentId}/submissions/${submissionId}/review`,
        method: "PATCH",
        body: { status, comment },
      }),
      transformResponse: (res: { data: PlayerAssignmentSubmission }) => res.data,
      invalidatesTags: ["PlayerAssignments"],
    }),
    getCoachDailyAiInputs: builder.query<CoachDailyAiSummary, void>({
      query: () => "/coaches/me/daily-ai-inputs",
      transformResponse: (res: { data: CoachDailyAiSummary }) => res.data,
      providesTags: ["DailyAiInputs"],
    }),
  }),
});

export const {
  useGetCoachAccessStatusQuery,
  useGetCoachManageBranchesQuery,
  useGetCoachBirthdaysQuery,
  useGetCoachDashboardQuery,
  useGetCoachGroupsQuery,
  useGetCoachGroupQuery,
  useCreateCoachGroupMutation,
  useUpdateCoachGroupMutation,
  useDeleteCoachGroupMutation,
  useCreateCoachBirthYearMutation,
  useDeleteCoachBirthYearMutation,
  useGetCoachSessionsQuery,
  useGetCoachSessionQuery,
  useMarkCoachAttendanceMutation,
  useGetCoachAttendanceHistoryQuery,
  useSaveCoachMeasurementsMutation,
  useGetCoachEvaluationsQuery,
  useCreateCoachEvaluationMutation,
  useGetMyCoachAssignmentsQuery,
  useSubmitCoachAssignmentMutation,
  useUploadCoachAssignmentFileMutation,
  useGetMyPlayerAssignmentsQuery,
  useCreateMyPlayerAssignmentMutation,
  useUpdateMyPlayerAssignmentMutation,
  useDeleteMyPlayerAssignmentMutation,
  useGetPlayerAssignmentSubmissionsQuery,
  useReviewPlayerAssignmentSubmissionMutation,
  useGetCoachDailyAiInputsQuery,
} = coachApi;
