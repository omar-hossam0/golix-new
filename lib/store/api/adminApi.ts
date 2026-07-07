import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithReauth } from "./baseQuery";
import type {
  PlayerExportRequest,
  PlayerImportResult,
  PlayerImportValidationResult,
} from "@/lib/types/playerImport";
import type { RankingSystemInput } from "./calendarApi";

// ─── Shared ──────────────────────────────────────────────────────────────────
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

// ─── Players ─────────────────────────────────────────────────────────────────
export interface PlayerRow {
  id: string;
  player_code?: string | null;
  full_name: string;
  date_of_birth: string | null;
  level: "A" | "B" | "C" | "D" | "F" | null;
  position: string | null;
  photo_url?: string | null;
  is_active?: boolean | null;
  profile_status?: "incomplete" | "complete";
  profile_completed_at?: string | null;
  date_joined?: string | null;
  created_at: string;
}

export interface PlayerDetail {
  id: string;
  user_id: string | null;
  academy_id: string;
  branch_id: string | null;
  full_name: string;
  date_of_birth: string | null;
  level: string | null;
  position: string | null;
  preferred_foot: string | null;
  photo_url?: string | null;
  date_joined?: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  profile_status?: "incomplete" | "complete";
  profile_completed_at?: string | null;
  notes: string | null;
  created_at: string;
}

export interface PlayerMeasurement {
  id: string;
  player_id: string;
  height_cm: string | null;
  weight_kg: string | null;
  sprint_speed?: string | null;
  stamina?: string | number | null;
  flexibility?: string | number | null;
  measured_at: string;
  measured_by: string | null;
  notes: string | null;
}

export interface CreatePlayerInput {
  username?: string;
  password?: string;
  phone?: string;
  fullName: string;
  birthDate: string;
  dateJoined?: string;
  gender?: "male" | "female" | "other";
  address?: string;
  nationality?: string;
  isActive?: boolean;
  branchId: string;
  groupId?: string;
  level?: "A" | "B" | "C" | "D" | "F";
  position?: string;
  preferredFoot?: "left" | "right" | "both";
  guardianName?: string;
  guardianPhone?: string;
  guardianRelation?: string;
  heightCm?: number;
  weightKg?: number;
  bmi?: number;
  sprintSpeed?: number;
  stamina?: number;
  flexibility?: number;
  ballControl?: number;
  firstTouch?: number;
  passing?: number;
  shooting?: number;
  dribbling?: number;
  crossing?: number;
  heading?: number;
  tackling?: number;
  weakFoot?: number;
  finishing?: number;
  longPassing?: number;
  shortPassing?: number;
  positioning?: number;
  decisionMaking?: number;
  offBallMovement?: number;
  pressing?: number;
  defensiveAwareness?: number;
  teamwork?: number;
  gameReading?: number;
  trackingBack?: number;
  creatingSpace?: number;
  tacticalDiscipline?: number;
  trainingSessionsCount?: number;
  attendanceCount?: number;
  absenceCount?: number;
  lateArrivals?: number;
  attendanceRate?: number;
  trainingPerformanceRating?: number;
  coachNotes?: string;
  improvementNotes?: string;
  matchesPlayed?: number;
  minutesPlayed?: number;
  goals?: number;
  assists?: number;
  shots?: number;
  shotsOnTarget?: number;
  passAccuracy?: number;
  keyPasses?: number;
  successfulDribbles?: number;
  tackles?: number;
  interceptions?: number;
  fouls?: number;
  yellowCards?: number;
  redCards?: number;
  manOfTheMatchCount?: number;
  matchRating?: number;
  medicalNotes?: string;
  injuryHistory?: string;
  currentInjuryStatus?: "none" | "injured" | "rehab" | "recovered";
  injuryType?: string;
  injuryDate?: string;
  recoveryDate?: string;
  fitnessStatus?: "fit" | "limited" | "unfit" | "medical_hold";
  allergies?: string;
  chronicProblems?: string;
  overallRating?: number;
  potentialRating?: number;
  strengths?: string;
  weaknesses?: string;
  recommendedPosition?: string;
  developmentPlan?: string;
  coachFinalNotes?: string;
  subscriptionType?: "monthly" | "quarterly" | "yearly";
  monthlyFees?: number;
  paymentStatus?: "pending" | "paid" | "overdue" | "cancelled";
  lastPaymentDate?: string;
  nextPaymentDue?: string;
  discount?: number;
  penalty?: number;
  notes?: string;
  markProfileComplete?: boolean;
}

// ─── Coaches ─────────────────────────────────────────────────────────────────
export interface CoachRow {
  id: string;
  username: string | null;
  full_name: string;
  first_name?: string;
  last_name?: string;
  email: string;
  phone: string;
  role?: CoachRole;
  is_active: boolean | null;
  branch_id?: string | null;
  branch_name?: string | null;
  branches?: Array<{ id: string; name: string; role: CoachAssignmentRole }>;
  specialization: string | null;
  bio?: string | null;
  experience_years: number | null;
  rating: number | null;
  image?: string | null;
  photo_url: string | null;
  totp_enabled?: boolean | null;
  totp_verified_at?: string | null;
  created_at: string;
}

export interface CoachDetail {
  id: string;
  user_id: string | null;
  academy_id: string;
  full_name: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  role?: CoachRole;
  username?: string | null;
  auth_email?: string | null;
  auth_phone?: string | null;
  is_active?: boolean | null;
  branch_name?: string | null;
  specialization: string | null;
  bio: string | null;
  photo_url: string | null;
  totp_enabled?: boolean | null;
  totp_verified_at?: string | null;
  created_at: string;
}

export interface CoachGroupAssignment {
  id: string;
  coach_id: string;
  group_id: string;
  role: string;
  assigned_at: string;
}

export type CoachAccessType = "groups" | "birth_years" | "both";
export type CoachAssignmentPermissionKey =
  | "create_training"
  | "take_attendance"
  | "evaluate_players"
  | "record_measurements"
  | "manage_player_assignments"
  | "manage_players"
  | "manage_groups"
  | "manage_matches"
  | "view_injury_risk"
  | "run_injury_risk"
  | "manage_injury_risk";
export type CoachAssignmentRole =
  | "head_coach"
  | "assistant_coach"
  | "goalkeeping_coach"
  | "fitness_coach"
  | "technical_coach"
  | "tactical_coach"
  | "goalkeeping_assistant"
  | "performance_analyst"
  | "team_manager"
  | "physiotherapist"
  | "rehabilitation_coach"
  | "scout"
  | "academy_director"
  | "youth_coach"
  | "conditioning_coach";

export interface CoachAssignmentRoleDefinition {
  value: CoachAssignmentRole;
  label: string;
  description: string;
  permissions: Array<{
    key: CoachAssignmentPermissionKey;
    label: string;
    granted: boolean;
  }>;
}

export interface CoachAccessRule {
  id: string | null;
  coachId: string;
  branchId: string;
  branchName: string | null;
  accessType: CoachAccessType;
  role: CoachAssignmentRole;
  allGroups: boolean;
  allBirthYears: boolean;
  groupIds: string[];
  birthYearIds: string[];
  groups: Array<{ id: string; name: string; branchId: string }>;
  birthYears: Array<{
    id: string;
    label: string;
    normalizedLabel: string;
    fromYear: number;
    toYear: number;
    branchId: string;
  }>;
  assignedGroups: Array<{
    id: string;
    name: string;
    role: string;
    assignedAt: string;
    permissions: Partial<Record<CoachAssignmentPermissionKey, boolean>>;
  }>;
  permissions: Record<CoachAssignmentPermissionKey, boolean>;
  isInferred: boolean;
}

export interface UpsertCoachAccessInput {
  coachId: string;
  branchId: string;
  accessType: CoachAccessType;
  role: CoachAssignmentRole;
  allGroups?: boolean;
  allBirthYears?: boolean;
  groupIds?: string[];
  birthYearIds?: string[];
}

export interface AuthUser {
  id: string;
  username: string | null;
  email: string | null;
  phone: string | null;
  role: "admin" | "coach" | "player" | "parent";
  isActive?: boolean;
  isVerified?: boolean;
  totpEnabled?: boolean;
  totpVerifiedAt?: string | null;
}

export interface PasswordResetRequest {
  id: string;
  userId: string;
  role: "admin" | "coach" | "player" | "parent";
  username: string | null;
  email: string | null;
  phone: string | null;
  playerId: string | null;
  playerName: string | null;
  coachId: string | null;
  coachName: string | null;
  displayName: string;
  status: "pending" | "expired" | "resolved";
  expiresAt: string;
  isUsed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Setup2FAResponse {
  deviceId?: string;
  deviceName?: string;
  issuer?: string;
  secret: string;
  qrCode: string;
  coachId?: string;
  coachName?: string;
}

export interface Verify2FASetupResponse {
  backupCodes: string[];
  coachId?: string;
  coachName?: string;
}

export interface MfaDevice {
  id: string;
  deviceName: string;
  status: "pending" | "active" | "revoked";
  isPrimary: boolean;
  verifiedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

export interface RegisterUserInput {
  username: string;
  email?: string;
  password: string;
  role: "coach" | "player" | "parent";
  phone?: string;
  fullName?: string;
}

export type CoachRole =
  | "head_coach"
  | "assistant_coach"
  | "goalkeeping_coach"
  | "fitness_coach"
  | "technical_coach"
  | "tactical_coach"
  | "goalkeeping_assistant"
  | "performance_analyst"
  | "team_manager"
  | "physiotherapist"
  | "rehabilitation_coach"
  | "scout"
  | "academy_director"
  | "youth_coach"
  | "conditioning_coach";

export interface CreateCoachInput {
  userId: string;
  branchId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: CoachRole;
  image?: string | null;
  fullName?: string;
  specialization?: string;
  bio?: string | null;
}

export interface UpdateCoachInput {
  branchId?: string | null;
  email?: string;
  phone?: string;
  role?: CoachRole;
  image?: string | null;
  photoUrl?: string | null;
  specialization?: string | null;
  bio?: string | null;
  isActive?: boolean;
  password?: string;
}

export interface CoachImageUploadResponse {
  fileName: string;
  image: string;
  mimeType: string;
  sizeBytes: number;
}

// ─── Payments ────────────────────────────────────────────────────────────────
export interface PaymentOverviewItem {
  status: string;
  total_amount: string;
  count: string;
}

export interface Subscription {
  id: string;
  player_id: string;
  plan_id: string;
  status: string;
  starts_at: string;
  ends_at: string;
  amount: string;
  created_at: string;
}

export interface Invoice {
  id: string;
  subscription_id: string;
  amount: string;
  status: string;
  due_date: string;
  paid_at: string | null;
  created_at: string;
}

// ─── Attendance ───────────────────────────────────────────────────────────────
export interface AttendanceOverview {
  totalTrainings: number;
  totalRecords?: number;
  attendedCount?: number;
  missedCount?: number;
  avgRate: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  excusedCount: number;
  injuredCount: number;
  statusCounts?: {
    present: number;
    late: number;
    absent: number;
    excused: number;
    injured: number;
  };
  trainingStatusCounts?: {
    scheduled: number;
    completed: number;
    cancelled: number;
  };
  byGroup: {
    groupId: string;
    groupName: string;
    rate: number;
    total: number;
    attended?: number;
    present?: number;
    late?: number;
    absent?: number;
    excused?: number;
    injured?: number;
  }[];
  byBranch?: {
    branchId: string;
    branchName: string;
    rate: number;
    total: number;
    attended: number;
    present: number;
    late: number;
    absent: number;
    excused: number;
    injured: number;
  }[];
  recentSessions?: {
    id: string;
    title: string;
    startDatetime: string;
    endDatetime: string;
    location: string | null;
    status: string;
    trainingFocus: string | null;
    intensityLevel: string | null;
    coachName: string | null;
    groupNames: string | null;
    recordedCount: number;
    attendedCount: number;
    absentCount: number;
    injuredCount: number;
    rate: number;
  }[];
  lowAttendancePlayers?: {
    playerId: string;
    playerName: string;
    position: string | null;
    groupId: string;
    groupName: string;
    branchName: string;
    total: number;
    attended: number;
    absent: number;
    injured: number;
    lastSessionAt: string | null;
    rate: number;
  }[];
}

// ─── Rankings ────────────────────────────────────────────────────────────────
export interface RankingRow {
  id: string;
  player_id: string;
  player_name: string;
  group_id: string;
  group_name: string;
  total_score: string;
  rank: number;
  period: string;
  calculated_at: string;
}

// ─── Notifications ────────────────────────────────────────────────────────────
export interface NotificationRow {
  id: string;
  title: string;
  body: string;
  type: string;
  data?: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
}

// ─── Academy ─────────────────────────────────────────────────────────────────
export interface Branch {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  capacity: number | null;
  is_active: boolean;
  created_at: string;
}

export interface CreateBranchInput {
  name: string;
  address?: string;
  city?: string;
  capacity?: number;
}

export interface UpdateBranchInput extends Partial<CreateBranchInput> {
  isActive?: boolean;
}

export interface Group {
  id: string;
  name: string;
  description?: string | null;
  branch_id: string;
  branch_name?: string | null;
  birth_year_id?: string;
  birth_year?: number;
  birth_year_label?: string | null;
  birth_years?: Array<
    BirthYearRange & { label: string; normalizedLabel?: string }
  >;
  players?: Array<{
    id: string;
    fullName: string;
    playerCode?: string | null;
    birthDate?: string | null;
  }>;
  assignment_mode?: GroupAssignmentMode;
  max_players: number | null;
  is_active: boolean;
  player_count?: number;
  coach_count?: number;
  created_at: string;
}

export type GroupAssignmentMode = "birth_year" | "players";

export interface CreateGroupInput {
  branchId: string;
  assignmentMode?: GroupAssignmentMode;
  birthYearIds?: string[];
  birthYearId?: string;
  playerIds?: string[];
  playerCodeFrom?: string;
  playerCodeTo?: string;
  name: string;
  description?: string;
  maxPlayers?: number;
}

export interface UpdateGroupInput extends Partial<
  Omit<CreateGroupInput, "branchId">
> {
  isActive?: boolean;
}

export interface BirthYearRange {
  id: string;
  fromYear: number;
  toYear: number;
  label?: string;
  createdByRole?: "admin" | "coach";
  createdByUserId?: string | null;
  createdByCoachId?: string | null;
  createdByName?: string | null;
}

export interface BirthYearGroup {
  label: string;
  normalizedLabel: string;
  birthYears: BirthYearRange[];
}

export interface BirthYearDetail extends BirthYearRange {
  branchId: string;
  branchName: string;
  label: string;
  normalizedLabel: string;
  groups: Array<{
    id: string;
    name: string;
    description?: string | null;
    max_players?: number | null;
    assignment_mode?: string;
  }>;
  players: Array<{
    id: string;
    full_name: string;
    player_code?: string | null;
    date_of_birth: string | null;
    phone?: string | null;
    level?: string | null;
    position?: string | null;
  }>;
  coaches: Array<{
    id: string;
    full_name: string;
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    phone?: string | null;
    role?: string | null;
    image?: string | null;
    photo_url?: string | null;
  }>;
}

export interface CreateBirthYearInput {
  branchId: string;
  label?: string;
  fromYear: number;
  toYear: number;
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
  academyId: string;
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
  reviewedAt: string | null;
  adminNotes: string;
  coachNotes: string;
  attachments: CoachAssignmentFile[];
  submissions: CoachAssignmentFile[];
  files: CoachAssignmentFile[];
}

export interface AssignmentFileInput {
  fileType: "pdf" | "word" | "image";
  fileName: string;
  fileUrl: string;
  mimeType?: string;
  sizeBytes?: number;
}

export interface CreateCoachAssignmentInput {
  coachId: string;
  branchId?: string;
  groupId?: string;
  title: string;
  description?: string;
  dueDate?: string;
  adminNotes?: string;
  attachments?: AssignmentFileInput[];
}

export interface AcademyInfo {
  id: string;
  name: string;
  logo_url: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  settings: Record<string, unknown> | null;
}

export type AcademyUpdateInput = Partial<
  Omit<AcademyInfo, "id" | "logo_url">
> & {
  logoUrl?: string | null;
};

export interface AdminPermission {
  id: string;
  code: string;
  resource: string;
  action: string;
  scope: "system" | "academy" | "branch" | "team" | "self";
  description: string | null;
  isSystem: boolean;
}

export interface AdminPermissionGroup {
  id: string | null;
  code: string;
  name: string;
  description: string | null;
  sortOrder: number;
  permissions: AdminPermission[];
}

export interface AdminRolePermissionAssignment {
  permissionId: string;
  denied: boolean;
}

export interface AdminRole {
  id: string;
  academyId: string | null;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  priority: number;
  userCount: number;
  createdAt: string;
  updatedAt: string;
  permissionAssignments: AdminRolePermissionAssignment[];
}

export interface AdminUserRoleAssignment {
  id: string;
  roleId: string;
  scopeBranchId: string | null;
  scopeGroupId: string | null;
  grantedAt: string;
  expiresAt: string | null;
}

export interface AdminAccessUser {
  id: string;
  fullName: string;
  email: string | null;
  username: string | null;
  phone: string | null;
  role: "admin" | "coach" | "player" | "parent";
  isActive: boolean;
  address?: string | null;
  jobTitle?: string | null;
  department?: string | null;
  notes?: string | null;
  roleAssignments: AdminUserRoleAssignment[];
}

export interface AdminAccessControl {
  permissionGroups: AdminPermissionGroup[];
  roles: AdminRole[];
  users: AdminAccessUser[];
}

export interface AdminRoleInput {
  name: string;
  code: string;
  description?: string | null;
  isActive?: boolean;
  permissionIds: string[];
}

export interface CreateAdminAccessUserInput {
  fullName: string;
  accountRole: "admin" | "coach";
  email?: string | null;
  phone: string;
  username: string;
  password: string;
  address?: string | null;
  jobTitle?: string | null;
  department?: string | null;
  notes?: string | null;
  roleId?: string | null;
}

export interface CreateAdminAccessUserResult {
  message: string;
  user: AdminAccessUser;
  users: AdminAccessUser[];
  roles: AdminRole[];
}

export interface CurrentPermissions {
  permissions: string[];
  source: "iam" | "legacy" | "legacy_admin";
}

export interface DatabaseBackup {
  fileName: string;
  sizeBytes: number;
  createdAt: string;
  checksum: string | null;
}

export interface DatabaseBackupStatus {
  backupDir: string;
  automaticEnabled: boolean;
  intervalMinutes: number;
  retentionDays: number;
  restoreEnabled: boolean;
  restoreConfirmation: string;
  latestBackup: DatabaseBackup | null;
  backups: DatabaseBackup[];
}

export interface RestoreDatabaseBackupInput {
  fileName: string;
  password: string;
  confirmation: string;
}

export interface RestoreDatabaseBackupResult {
  fileName: string;
  restoredAt: string;
  safetyBackup: DatabaseBackup;
}

// ─── API ─────────────────────────────────────────────────────────────────────
export const adminApi = createApi({
  reducerPath: "adminApi",
  baseQuery: baseQueryWithReauth,
  keepUnusedDataFor: 300,
  tagTypes: [
    "Players",
    "Coaches",
    "CoachAssignments",
    "Payments",
    "Subscriptions",
    "Invoices",
    "Attendance",
    "Rankings",
    "Notifications",
    "Branches",
    "BirthYears",
    "Groups",
    "CurrentUser",
    "CurrentPermissions",
    "Academy",
    "AccessControl",
    "DatabaseBackups",
  ],
  endpoints: (builder) => ({
    // ── Players ──────────────────────────────────────────────────────────
    getPlayers: builder.query<
      PaginatedResponse<PlayerRow>,
      {
        page?: number;
        limit?: number;
        search?: string;
        level?: string;
        branchId?: string;
      }
    >({
      query: ({ page = 1, limit = 20, search, level, branchId } = {}) => {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(limit),
        });
        if (search) params.set("search", search);
        if (level) params.set("level", level);
        if (branchId) params.set("branchId", branchId);
        return `/players?${params}`;
      },
      transformResponse: (res: ApiListResponse<PlayerRow>) => toPaginated(res),
      providesTags: ["Players"],
    }),

    createPlayer: builder.mutation<PlayerDetail, CreatePlayerInput>({
      query: (body) => ({ url: "/players", method: "POST", body }),
      transformResponse: (res: { data: PlayerDetail }) => res.data,
      invalidatesTags: ["Players"],
    }),

    downloadPlayerImportTemplate: builder.mutation<
      string,
      PlayerExportRequest
    >({
      query: ({ mode, confirmation }) => ({
        url: `/players/export?${new URLSearchParams({
          mode,
          ...(confirmation ? { confirmation } : {}),
        })}`,
        method: "GET",
        responseHandler: async (response) => {
          if (!response.ok) return response.json();
          return URL.createObjectURL(await response.blob());
        },
      }),
    }),

    validatePlayerImport: builder.mutation<
      PlayerImportValidationResult,
      File
    >({
      query: (file) => {
        const body = new FormData();
        body.append("file", file);
        return {
          url: "/players/import/validate",
          method: "POST",
          body,
        };
      },
      transformResponse: (res: { data: PlayerImportValidationResult }) =>
        res.data,
    }),

    importPlayers: builder.mutation<PlayerImportResult, File>({
      query: (file) => {
        const body = new FormData();
        body.append("file", file);
        return {
          url: "/players/import",
          method: "POST",
          body,
        };
      },
      transformResponse: (res: { data: PlayerImportResult }) => res.data,
      invalidatesTags: ["Players"],
    }),

    updatePlayer: builder.mutation<
      PlayerDetail,
      { id: string; body: Partial<CreatePlayerInput> }
    >({
      query: ({ id, body }) => ({ url: `/players/${id}`, method: "PUT", body }),
      transformResponse: (res: { data: PlayerDetail }) => res.data,
      invalidatesTags: ["Players", "AccessControl"],
    }),

    deletePlayer: builder.mutation<void, string>({
      query: (id) => ({ url: `/players/${id}`, method: "DELETE" }),
      invalidatesTags: ["Players"],
    }),

    hardDeletePlayer: builder.mutation<void, string>({
      query: (id) => ({ url: `/players/${id}/hard-delete`, method: "DELETE" }),
      invalidatesTags: ["Players"],
    }),

    // ── Coaches ──────────────────────────────────────────────────────────
    getCoaches: builder.query<
      PaginatedResponse<CoachRow>,
      { page?: number; limit?: number }
    >({
      query: ({ page = 1, limit = 20 } = {}) =>
        `/coaches?page=${page}&limit=${limit}`,
      transformResponse: (res: ApiListResponse<CoachRow>) => toPaginated(res),
      providesTags: ["Coaches"],
    }),

    registerUser: builder.mutation<AuthUser, RegisterUserInput>({
      query: (body) => ({ url: "/auth/register", method: "POST", body }),
      transformResponse: (res: { data: { user: AuthUser } }) => res.data.user,
    }),

    createCoach: builder.mutation<CoachDetail, CreateCoachInput>({
      query: (body) => ({ url: "/coaches", method: "POST", body }),
      transformResponse: (res: { data: CoachDetail }) => res.data,
      invalidatesTags: ["Coaches"],
    }),

    updateCoach: builder.mutation<
      CoachDetail,
      { id: string; body: UpdateCoachInput }
    >({
      query: ({ id, body }) => ({ url: `/coaches/${id}`, method: "PUT", body }),
      transformResponse: (res: { data: CoachDetail }) => res.data,
      invalidatesTags: ["Coaches"],
    }),

    deleteCoach: builder.mutation<void, string>({
      query: (id) => ({ url: `/coaches/${id}`, method: "DELETE" }),
      invalidatesTags: ["Coaches"],
    }),

    hardDeleteCoach: builder.mutation<void, string>({
      query: (id) => ({ url: `/coaches/${id}/hard-delete`, method: "DELETE" }),
      invalidatesTags: ["Coaches"],
    }),

    uploadCoachImage: builder.mutation<CoachImageUploadResponse, File>({
      query: (file) => {
        const body = new FormData();
        body.append("image", file);
        return { url: "/coaches/images", method: "POST", body };
      },
      transformResponse: (res: { data: CoachImageUploadResponse }) => res.data,
    }),

    // ── Payments overview ────────────────────────────────────────────────
    setupCoachMfa: builder.mutation<
      Setup2FAResponse,
      { coachId: string; deviceName?: string; resetExisting?: boolean }
    >({
      query: ({ coachId, deviceName, resetExisting }) => ({
        url: `/coaches/${coachId}/mfa/setup`,
        method: "POST",
        body: { deviceName, resetExisting },
      }),
      transformResponse: (res: { data: Setup2FAResponse }) => res.data,
      invalidatesTags: ["Coaches"],
    }),

    verifyCoachMfa: builder.mutation<
      Verify2FASetupResponse,
      { coachId: string; deviceId: string; token: string }
    >({
      query: ({ coachId, deviceId, token }) => ({
        url: `/coaches/${coachId}/mfa/verify`,
        method: "POST",
        body: { deviceId, token },
      }),
      transformResponse: (res: { data: Verify2FASetupResponse }) => res.data,
      invalidatesTags: ["Coaches"],
    }),

    regenerateCoachMfaBackupCodes: builder.mutation<
      Verify2FASetupResponse,
      { coachId: string }
    >({
      query: ({ coachId }) => ({
        url: `/coaches/${coachId}/mfa/backup-codes/regenerate`,
        method: "POST",
      }),
      transformResponse: (res: { data: Verify2FASetupResponse }) => res.data,
      invalidatesTags: ["Coaches"],
    }),

    getPaymentOverview: builder.query<PaymentOverviewItem[], void>({
      query: () => "/payments/overview",
      transformResponse: (res: { data: PaymentOverviewItem[] }) => res.data,
      providesTags: ["Payments"],
    }),

    // ── Subscriptions ────────────────────────────────────────────────────
    getSubscriptions: builder.query<
      PaginatedResponse<Subscription>,
      { page?: number; limit?: number; status?: string }
    >({
      query: ({ page = 1, limit = 20, status } = {}) => {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(limit),
        });
        if (status) params.set("status", status);
        return `/payments/subscriptions?${params}`;
      },
      transformResponse: (res: ApiListResponse<Subscription>) =>
        toPaginated(res),
      providesTags: ["Subscriptions"],
    }),

    // ── Invoices ─────────────────────────────────────────────────────────
    getInvoices: builder.query<
      PaginatedResponse<Invoice>,
      { page?: number; limit?: number; status?: string }
    >({
      query: ({ page = 1, limit = 20, status } = {}) => {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(limit),
        });
        if (status) params.set("status", status);
        return `/payments/invoices?${params}`;
      },
      transformResponse: (res: ApiListResponse<Invoice>) => toPaginated(res),
      providesTags: ["Invoices"],
    }),

    // ── Attendance overview ──────────────────────────────────────────────
    getAttendanceOverview: builder.query<AttendanceOverview, void>({
      query: () => "/attendance/overview",
      transformResponse: (res: { data: AttendanceOverview }) => res.data,
      providesTags: ["Attendance"],
      keepUnusedDataFor: 30,
    }),

    // ── Rankings ─────────────────────────────────────────────────────────
    getWeeklyRankings: builder.query<
      PaginatedResponse<RankingRow>,
      { groupId?: string; page?: number; limit?: number }
    >({
      query: ({ groupId, page = 1, limit = 50 } = {}) => {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(limit),
        });
        if (groupId) params.set("groupId", groupId);
        return `/rankings/weekly?${params}`;
      },
      transformResponse: (res: ApiListResponse<RankingRow>) => toPaginated(res),
      providesTags: ["Rankings"],
    }),

    getMonthlyRankings: builder.query<
      PaginatedResponse<RankingRow>,
      { groupId?: string; page?: number; limit?: number }
    >({
      query: ({ groupId, page = 1, limit = 50 } = {}) => {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(limit),
        });
        if (groupId) params.set("groupId", groupId);
        return `/rankings/monthly?${params}`;
      },
      transformResponse: (res: ApiListResponse<RankingRow>) => toPaginated(res),
      providesTags: ["Rankings"],
    }),

    getAdminRankingSystemInputs: builder.query<
      PaginatedResponse<RankingSystemInput>,
      { groupId?: string; page?: number; limit?: number } | void
    >({
      query: (args) => {
        const params = new URLSearchParams({
          page: String(args?.page ?? 1),
          limit: String(args?.limit ?? 150),
        });
        if (args?.groupId) params.set("groupId", args.groupId);
        return `/admin/ranking-system-inputs?${params}`;
      },
      transformResponse: (res: ApiListResponse<RankingSystemInput>) =>
        toPaginated(res),
      providesTags: ["Rankings"],
    }),

    // ── Notifications ────────────────────────────────────────────────────
    getNotifications: builder.query<
      PaginatedResponse<NotificationRow>,
      { page?: number; limit?: number }
    >({
      query: ({ page = 1, limit = 30 } = {}) =>
        `/notifications?page=${page}&limit=${limit}`,
      transformResponse: (res: ApiListResponse<NotificationRow>) =>
        toPaginated(res),
      providesTags: ["Notifications"],
    }),

    markNotificationRead: builder.mutation<void, string>({
      query: (id) => ({ url: `/notifications/${id}/read`, method: "PATCH" }),
      invalidatesTags: ["Notifications"],
    }),

    markAllNotificationsRead: builder.mutation<void, void>({
      query: () => ({ url: "/notifications/read-all", method: "PATCH" }),
      invalidatesTags: ["Notifications"],
    }),

    sendNotification: builder.mutation<
      void,
      {
        title: string;
        body: string;
        type: string;
        targetRole?: string;
        targetUserId?: string;
      }
    >({
      query: (body) => ({ url: "/notifications/send", method: "POST", body }),
      invalidatesTags: ["Notifications"],
    }),

    // ── Branches ─────────────────────────────────────────────────────────
    getBranches: builder.query<Branch[], void>({
      query: () => "/academy/branches?limit=100",
      transformResponse: (res: { data: Branch[] }) => res.data,
      providesTags: ["Branches"],
    }),

    createBranch: builder.mutation<Branch, CreateBranchInput>({
      query: (body) => ({ url: "/academy/branches", method: "POST", body }),
      transformResponse: (res: { data: Branch }) => res.data,
      invalidatesTags: ["Branches"],
    }),

    updateBranch: builder.mutation<
      Branch,
      { id: string; body: UpdateBranchInput }
    >({
      query: ({ id, body }) => ({
        url: `/academy/branches/${id}`,
        method: "PUT",
        body,
      }),
      transformResponse: (res: { data: Branch }) => res.data,
      invalidatesTags: ["Branches", "Groups", "BirthYears"],
    }),

    deleteBranch: builder.mutation<void, string>({
      query: (id) => ({ url: `/academy/branches/${id}`, method: "DELETE" }),
      invalidatesTags: ["Branches", "Groups", "BirthYears"],
    }),

    // ── Groups ────────────────────────────────────────────────────────────
    getGroups: builder.query<Group[], { branchId?: string }>({
      query: ({ branchId } = {}) => {
        const params = new URLSearchParams({ limit: "100" });
        if (branchId) params.set("branchId", branchId);
        return `/academy/groups?${params}`;
      },
      transformResponse: (res: { data: Group[] }) => res.data,
      providesTags: ["Groups"],
    }),

    createGroup: builder.mutation<Group, CreateGroupInput>({
      query: (body) => ({ url: "/academy/groups", method: "POST", body }),
      transformResponse: (res: { data: Group }) => res.data,
      invalidatesTags: ["Groups", "Branches"],
    }),

    updateGroup: builder.mutation<
      Group,
      { id: string; body: UpdateGroupInput }
    >({
      query: ({ id, body }) => ({
        url: `/academy/groups/${id}`,
        method: "PATCH",
        body,
      }),
      transformResponse: (res: { data: Group }) => res.data,
      invalidatesTags: ["Groups", "Branches"],
    }),

    deleteGroup: builder.mutation<void, string>({
      query: (id) => ({ url: `/academy/groups/${id}`, method: "DELETE" }),
      invalidatesTags: ["Groups", "Branches"],
    }),

    // ── Player detail ────────────────────────────────────────────────────
    getPlayerById: builder.query<PlayerDetail, string>({
      query: (id) => `/players/${id}`,
      transformResponse: (res: { data: PlayerDetail }) => res.data,
      providesTags: ["Players"],
    }),

    // ── Player measurements ──────────────────────────────────────────────
    getPlayerMeasurements: builder.query<
      PaginatedResponse<PlayerMeasurement>,
      { playerId: string; page?: number; limit?: number }
    >({
      query: ({ playerId, page = 1, limit = 50 }) =>
        `/players/${playerId}/measurements?page=${page}&limit=${limit}`,
      transformResponse: (res: ApiListResponse<PlayerMeasurement>) =>
        toPaginated(res),
      providesTags: ["Players"],
    }),

    // ── Coach detail ─────────────────────────────────────────────────────
    getCoachById: builder.query<CoachDetail, string>({
      query: (id) => `/coaches/${id}`,
      transformResponse: (res: { data: CoachDetail }) => res.data,
      providesTags: ["Coaches"],
    }),

    // ── Coach groups ─────────────────────────────────────────────────────
    getCoachGroups: builder.query<CoachGroupAssignment[], string>({
      query: (coachId) => `/coaches/${coachId}/groups`,
      transformResponse: (res: { data: CoachGroupAssignment[] }) => res.data,
      providesTags: ["Groups"],
    }),

    // ── Assign coach to group ────────────────────────────────────────────
    assignCoachToGroup: builder.mutation<
      void,
      { coachId: string; groupId: string; role?: string }
    >({
      query: ({ coachId, ...body }) => ({
        url: `/coaches/${coachId}/assign-group`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["Groups", "Coaches"],
    }),

    // ── Branch detail ────────────────────────────────────────────────────
    getCoachAccess: builder.query<
      CoachAccessRule[],
      { coachId: string; branchId?: string }
    >({
      query: ({ coachId, branchId }) => {
        const params = new URLSearchParams();
        if (branchId) params.set("branchId", branchId);
        return `/coaches/${coachId}/access${params.toString() ? `?${params}` : ""}`;
      },
      transformResponse: (res: { data: CoachAccessRule[] }) => res.data,
      providesTags: ["Coaches", "Groups"],
    }),

    getCoachAccessRoles: builder.query<CoachAssignmentRoleDefinition[], void>({
      query: () => "/coaches/access-roles",
      transformResponse: (res: { data: CoachAssignmentRoleDefinition[] }) => res.data,
      keepUnusedDataFor: 300,
    }),

    upsertCoachAccess: builder.mutation<
      CoachAccessRule,
      UpsertCoachAccessInput
    >({
      query: ({ coachId, ...body }) => ({
        url: `/coaches/${coachId}/access`,
        method: "PUT",
        body,
      }),
      transformResponse: (res: { data: CoachAccessRule }) => res.data,
      invalidatesTags: ["Groups", "Coaches"],
    }),

    removeCoachAccess: builder.mutation<
      { message: string },
      { coachId: string; branchId: string }
    >({
      query: ({ coachId, branchId }) => ({
        url: `/coaches/${coachId}/access/branches/${branchId}`,
        method: "DELETE",
      }),
      transformResponse: (res: { data: { message: string } }) => res.data,
      invalidatesTags: ["Groups", "Coaches"],
    }),

    getBranchById: builder.query<Branch, string>({
      query: (id) => `/academy/branches/${id}`,
      transformResponse: (res: { data: Branch }) => res.data,
      providesTags: ["Branches"],
    }),

    // ── Birth years ──────────────────────────────────────────────────────
    getBirthYears: builder.query<BirthYearGroup[], string>({
      query: (branchId) => `/academy/birth-years?branchId=${branchId}`,
      transformResponse: (res: { data: BirthYearGroup[] }) => res.data,
      providesTags: ["BirthYears"],
    }),

    getBirthYearById: builder.query<BirthYearDetail, string>({
      query: (id) => `/academy/birth-years/${id}`,
      transformResponse: (res: { data: BirthYearDetail }) => res.data,
      providesTags: ["BirthYears", "Groups", "Players", "Coaches"],
    }),

    createBirthYear: builder.mutation<void, CreateBirthYearInput>({
      query: (body) => ({ url: "/academy/birth-years", method: "POST", body }),
      invalidatesTags: ["BirthYears", "Branches"],
    }),

    updateBirthYear: builder.mutation<
      void,
      { id: string; body: Partial<Omit<CreateBirthYearInput, "branchId">> }
    >({
      query: ({ id, body }) => ({
        url: `/academy/birth-years/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["BirthYears", "Groups"],
    }),

    deleteBirthYear: builder.mutation<
      void,
      string | { id: string; transferBirthYearId?: string }
    >({
      query: (arg) => {
        const id = typeof arg === "string" ? arg : arg.id;
        const transferBirthYearId =
          typeof arg === "string" ? undefined : arg.transferBirthYearId;
        return {
          url: `/academy/birth-years/${id}`,
          method: "DELETE",
          body: transferBirthYearId ? { transferBirthYearId } : {},
        };
      },
      invalidatesTags: ["BirthYears", "Groups"],
    }),

    getCoachAssignments: builder.query<
      PaginatedResponse<CoachAssignment>,
      {
        coachId?: string;
        branchId?: string;
        groupId?: string;
        status?: string;
        page?: number;
        limit?: number;
      } | void
    >({
      query: (args) => {
        const params = new URLSearchParams({
          page: String(args?.page ?? 1),
          limit: String(args?.limit ?? 50),
        });
        if (args?.coachId) params.set("coachId", args.coachId);
        if (args?.branchId) params.set("branchId", args.branchId);
        if (args?.groupId) params.set("groupId", args.groupId);
        if (args?.status) params.set("status", args.status);
        return `/coaches/assignments?${params}`;
      },
      transformResponse: (res: ApiListResponse<CoachAssignment>) =>
        toPaginated(res),
      providesTags: ["CoachAssignments"],
    }),

    createCoachAssignment: builder.mutation<
      CoachAssignment,
      CreateCoachAssignmentInput
    >({
      query: (body) => ({ url: "/coaches/assignments", method: "POST", body }),
      transformResponse: (res: { data: CoachAssignment }) => res.data,
      invalidatesTags: ["CoachAssignments"],
    }),

    uploadCoachAssignmentFile: builder.mutation<AssignmentFileInput, File>({
      query: (file) => ({
        url: "/coaches/assignments/upload",
        method: "POST",
        body: file,
        headers: {
          "Content-Type": file.type || "application/octet-stream",
          "X-File-Name": encodeURIComponent(file.name || "assignment-file"),
        },
      }),
      transformResponse: (res: { data: AssignmentFileInput }) => res.data,
    }),

    // ── Admin settings / access control ─────────────────────────────────
    getAdminAccessControl: builder.query<AdminAccessControl, void>({
      query: () => "/admin/settings/access-control",
      transformResponse: (res: { data: AdminAccessControl }) => res.data,
      providesTags: ["AccessControl"],
    }),

    getAdminPasswordResetRequests: builder.query<PasswordResetRequest[], void>({
      query: () => "/admin/password-reset-requests",
      transformResponse: (res: { data: PasswordResetRequest[] }) => res.data,
      providesTags: ["AccessControl"],
    }),

    createAdminRole: builder.mutation<AdminRole, AdminRoleInput>({
      query: (body) => ({ url: "/admin/settings/roles", method: "POST", body }),
      transformResponse: (res: { data: AdminRole }) => res.data,
      invalidatesTags: ["AccessControl"],
    }),

    createAdminAccessUser: builder.mutation<
      CreateAdminAccessUserResult,
      CreateAdminAccessUserInput
    >({
      query: (body) => ({
        url: "/admin/settings/users",
        method: "POST",
        body,
      }),
      transformResponse: (res: { data: CreateAdminAccessUserResult }) =>
        res.data,
      invalidatesTags: ["AccessControl", "CurrentPermissions"],
    }),

    updateAdminRole: builder.mutation<
      AdminRole,
      { id: string; body: Partial<AdminRoleInput> }
    >({
      query: ({ id, body }) => ({
        url: `/admin/settings/roles/${id}`,
        method: "PATCH",
        body,
      }),
      transformResponse: (res: { data: AdminRole }) => res.data,
      invalidatesTags: ["AccessControl"],
    }),

    deleteAdminRole: builder.mutation<{ message: string }, string>({
      query: (id) => ({ url: `/admin/settings/roles/${id}`, method: "DELETE" }),
      transformResponse: (res: { data: { message: string } }) => res.data,
      invalidatesTags: ["AccessControl"],
    }),

    assignAdminRoleToUser: builder.mutation<
      { message: string },
      { roleId: string; userId: string }
    >({
      query: ({ roleId, userId }) => ({
        url: `/admin/settings/roles/${roleId}/users/${userId}`,
        method: "POST",
      }),
      transformResponse: (res: { data: { message: string } }) => res.data,
      invalidatesTags: ["AccessControl", "CurrentPermissions"],
    }),

    revokeAdminRoleFromUser: builder.mutation<
      { message: string },
      { roleId: string; userId: string }
    >({
      query: ({ roleId, userId }) => ({
        url: `/admin/settings/roles/${roleId}/users/${userId}`,
        method: "DELETE",
      }),
      transformResponse: (res: { data: { message: string } }) => res.data,
      invalidatesTags: ["AccessControl", "CurrentPermissions"],
    }),

    // ── Academy info ─────────────────────────────────────────────────────
    getAcademy: builder.query<AcademyInfo, void>({
      query: () => "/academy",
      transformResponse: (res: { data: AcademyInfo }) => res.data,
      providesTags: ["Academy"],
    }),

    updateAcademy: builder.mutation<AcademyInfo, AcademyUpdateInput>({
      query: (body) => ({ url: "/academy", method: "PUT", body }),
      transformResponse: (res: { data: AcademyInfo }) => res.data,
      invalidatesTags: ["Academy"],
    }),

    getDatabaseBackups: builder.query<DatabaseBackupStatus, void>({
      query: () => "/admin/settings/backups",
      transformResponse: (res: { data: DatabaseBackupStatus }) => res.data,
      providesTags: ["DatabaseBackups"],
    }),

    createDatabaseBackup: builder.mutation<DatabaseBackup, void>({
      query: () => ({ url: "/admin/settings/backups", method: "POST" }),
      transformResponse: (res: { data: DatabaseBackup }) => res.data,
      invalidatesTags: ["DatabaseBackups"],
    }),

    restoreDatabaseBackup: builder.mutation<
      RestoreDatabaseBackupResult,
      RestoreDatabaseBackupInput
    >({
      query: (body) => ({
        url: "/admin/settings/backups/restore",
        method: "POST",
        body,
      }),
      transformResponse: (res: { data: RestoreDatabaseBackupResult }) =>
        res.data,
      invalidatesTags: [
        "Academy",
        "AccessControl",
        "Attendance",
        "BirthYears",
        "Branches",
        "CoachAssignments",
        "Coaches",
        "CurrentPermissions",
        "CurrentUser",
        "DatabaseBackups",
        "Groups",
        "Invoices",
        "Notifications",
        "Payments",
        "Players",
        "Rankings",
        "Subscriptions",
      ],
    }),

    getCurrentUser: builder.query<AuthUser, void>({
      query: () => "/auth/me",
      transformResponse: (res: { data: AuthUser }) => res.data,
      providesTags: ["CurrentUser"],
    }),

    getCurrentPermissions: builder.query<CurrentPermissions, string | void>({
      query: () => "/auth/permissions",
      transformResponse: (res: { data: CurrentPermissions }) => res.data,
      providesTags: ["CurrentPermissions"],
      keepUnusedDataFor: 0,
    }),

    setup2FA: builder.mutation<Setup2FAResponse, void>({
      query: () => ({ url: "/auth/2fa/setup", method: "POST" }),
      transformResponse: (res: { data: Setup2FAResponse }) => res.data,
    }),

    verifySetup2FA: builder.mutation<Verify2FASetupResponse, string>({
      query: (token) => ({
        url: "/auth/2fa/verify-setup",
        method: "POST",
        body: { token },
      }),
      transformResponse: (res: { data: Verify2FASetupResponse }) => res.data,
      invalidatesTags: ["CurrentUser"],
    }),

    disable2FA: builder.mutation<{ message: string }, string>({
      query: (password) => ({
        url: "/auth/2fa/disable",
        method: "POST",
        body: { password },
      }),
      transformResponse: (res: { data: { message: string } }) => res.data,
      invalidatesTags: ["CurrentUser"],
    }),

    getMfaDevices: builder.query<MfaDevice[], void>({
      query: () => "/auth/2fa/devices",
      transformResponse: (res: { data: MfaDevice[] }) => res.data,
      providesTags: ["CurrentUser"],
    }),

    setupMfaDevice: builder.mutation<Setup2FAResponse, { deviceName?: string } | void>({
      query: (body) => ({
        url: "/auth/2fa/devices/setup",
        method: "POST",
        body: body ?? {},
      }),
      transformResponse: (res: { data: Setup2FAResponse }) => res.data,
    }),

    verifyMfaDevice: builder.mutation<MfaDevice, { deviceId: string; token: string }>({
      query: (body) => ({
        url: "/auth/2fa/devices/verify",
        method: "POST",
        body,
      }),
      transformResponse: (res: { data: MfaDevice }) => res.data,
      invalidatesTags: ["CurrentUser"],
    }),

    revokeMfaDevice: builder.mutation<MfaDevice, string>({
      query: (deviceId) => ({
        url: `/auth/2fa/devices/${deviceId}`,
        method: "DELETE",
      }),
      transformResponse: (res: { data: MfaDevice }) => res.data,
      invalidatesTags: ["CurrentUser"],
    }),

    regenerateMfaBackupCodes: builder.mutation<Verify2FASetupResponse, string>({
      query: (password) => ({
        url: "/auth/2fa/backup-codes/regenerate",
        method: "POST",
        body: { password },
      }),
      transformResponse: (res: { data: Verify2FASetupResponse }) => res.data,
    }),
  }),
});

export const {
  useGetPlayersQuery,
  useCreatePlayerMutation,
  useDownloadPlayerImportTemplateMutation,
  useValidatePlayerImportMutation,
  useImportPlayersMutation,
  useUpdatePlayerMutation,
  useDeletePlayerMutation,
  useHardDeletePlayerMutation,
  useGetCoachesQuery,
  useRegisterUserMutation,
  useCreateCoachMutation,
  useUpdateCoachMutation,
  useDeleteCoachMutation,
  useHardDeleteCoachMutation,
  useUploadCoachImageMutation,
  useSetupCoachMfaMutation,
  useVerifyCoachMfaMutation,
  useRegenerateCoachMfaBackupCodesMutation,
  useGetPaymentOverviewQuery,
  useGetSubscriptionsQuery,
  useGetInvoicesQuery,
  useGetAttendanceOverviewQuery,
  useGetWeeklyRankingsQuery,
  useGetMonthlyRankingsQuery,
  useGetAdminRankingSystemInputsQuery,
  useGetNotificationsQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
  useSendNotificationMutation,
  useGetBranchesQuery,
  useCreateBranchMutation,
  useUpdateBranchMutation,
  useDeleteBranchMutation,
  useGetGroupsQuery,
  useCreateGroupMutation,
  useUpdateGroupMutation,
  useDeleteGroupMutation,
  useGetPlayerByIdQuery,
  useGetPlayerMeasurementsQuery,
  useGetCoachByIdQuery,
  useGetCoachGroupsQuery,
  useAssignCoachToGroupMutation,
  useGetCoachAccessRolesQuery,
  useGetCoachAccessQuery,
  useUpsertCoachAccessMutation,
  useRemoveCoachAccessMutation,
  useGetBranchByIdQuery,
  useGetBirthYearsQuery,
  useGetBirthYearByIdQuery,
  useLazyGetBirthYearByIdQuery,
  useCreateBirthYearMutation,
  useUpdateBirthYearMutation,
  useDeleteBirthYearMutation,
  useGetCoachAssignmentsQuery,
  useCreateCoachAssignmentMutation,
  useUploadCoachAssignmentFileMutation,
  useGetAdminAccessControlQuery,
  useGetAdminPasswordResetRequestsQuery,
  useCreateAdminRoleMutation,
  useCreateAdminAccessUserMutation,
  useUpdateAdminRoleMutation,
  useDeleteAdminRoleMutation,
  useAssignAdminRoleToUserMutation,
  useRevokeAdminRoleFromUserMutation,
  useGetAcademyQuery,
  useUpdateAcademyMutation,
  useGetDatabaseBackupsQuery,
  useCreateDatabaseBackupMutation,
  useRestoreDatabaseBackupMutation,
  useGetCurrentUserQuery,
  useGetCurrentPermissionsQuery,
  useSetup2FAMutation,
  useVerifySetup2FAMutation,
  useDisable2FAMutation,
  useGetMfaDevicesQuery,
  useSetupMfaDeviceMutation,
  useVerifyMfaDeviceMutation,
  useRevokeMfaDeviceMutation,
  useRegenerateMfaBackupCodesMutation,
} = adminApi;
