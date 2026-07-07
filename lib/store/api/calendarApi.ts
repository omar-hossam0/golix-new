import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithReauth } from "./baseQuery";
import type {
  PlayerExportRequest,
  PlayerImportResult,
  PlayerImportValidationResult,
} from "@/lib/types/playerImport";

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

export type CalendarEventType =
  | "training"
  | "match"
  | "fitness_test"
  | "meeting"
  | "rest_day"
  | "tournament"
  | "medical_check"
  | "assessment_day";

export type MatchStatus =
  | "scheduled"
  | "postponed"
  | "cancelled"
  | "finished"
  | "completed";

export type CalendarEventStatus =
  | "scheduled"
  | "completed"
  | "finished"
  | "cancelled"
  | "postponed";

export interface EventGroup {
  id: string;
  name: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  event_type: CalendarEventType;
  start_datetime: string;
  end_datetime: string;
  location: string | null;
  status: CalendarEventStatus;
  visibility: "all_assigned_groups" | "selected_groups" | "coaches_only";
  notes: string | null;
  groups: EventGroup[];
  birth_years?: Array<{
    id: string;
    label: string;
    fromYear: number;
    toYear: number;
  }>;
  players?: Array<{ id: string; name: string }>;
  training?: {
    training_focus: string;
    intensity_level: string;
    objectives: string | null;
    session_plan: string | null;
    equipment_needed: string | null;
    coach_notes: string | null;
    original_end_datetime?: string | null;
    extended_minutes?: number;
    last_extended_at?: string | null;
  } | null;
  attendance?: TrainingAttendance[];
  evaluations?: TrainingEvaluation[];
  participants?: TrainingParticipant[];
}

export interface Match {
  id: string;
  event_id: string | null;
  academy_settings?: Record<string, unknown> | null;
  team_id: string | null;
  age_group_id: string | null;
  team_name?: string | null;
  opponent_name: string;
  match_type: "official" | "friendly" | "training" | "training_match";
  match_date: string;
  match_time: string;
  location: string | null;
  venue_type: "home" | "away" | "neutral";
  referee_name: string | null;
  status: MatchStatus;
  match_status: string;
  match_day_notified_at?: string | null;
  started_at?: string | null;
  first_half_started_at?: string | null;
  first_half_stoppage_minutes?: number;
  second_half_started_at?: string | null;
  second_half_stoppage_minutes?: number;
  finished_at?: string | null;
  evaluations_finalized_at?: string | null;
  evaluations_finalized_by_coach_id?: string | null;
  evaluation_edit_request?: MatchEvaluationEditRequest | null;
  evaluation_edit_unlocked_until?: string | null;
  organizer_notes: string | null;
  match_notes: string | null;
  our_score: number | null;
  opponent_score: number | null;
  groups: EventGroup[];
  birth_years?: Array<{
    id: string;
    label: string;
    fromYear: number;
    toYear: number;
  }>;
  squad?: MatchSquad[];
  evaluation_candidates?: MatchEvaluationCandidate[];
  tactics?: MatchTactics | null;
  attendance?: MatchAttendance[];
  stats?: MatchPlayerStats[];
  incidents?: MatchPlayerIncident[];
  goal_events?: MatchGoalEvent[];
  substitutions?: MatchSubstitution[];
  postponements?: MatchPostponement[];
}

export interface MatchSquad {
  id: string;
  match_id: string;
  player_id: string;
  player_name?: string;
  squad_role: "starter" | "substitute" | "reserve";
  position: string | null;
  shirt_number: number | null;
  player_instruction?: string | null;
  profile_status?: "incomplete" | "complete";
}

export type MatchEvaluationCandidate = MatchSquad & {
  is_target_fallback?: boolean;
};

export interface MatchEvaluationEditRequest {
  id: string;
  academy_id: string;
  match_id: string;
  coach_id: string;
  requested_by_user_id: string | null;
  reviewed_by_admin_id: string | null;
  status: "pending" | "approved" | "rejected";
  reason: string | null;
  admin_response: string | null;
  approved_at: string | null;
  expires_at: string | null;
  consumed_at: string | null;
  created_at: string;
  updated_at: string;
  coach_name?: string | null;
  coach_user_id?: string | null;
  opponent_name?: string | null;
  match_date?: string | null;
  match_time?: string | null;
  evaluations_finalized_at?: string | null;
}

export interface MatchTactics {
  id: string;
  match_id: string;
  formation: string;
  tactical_notes: string | null;
  coach_name?: string | null;
}

export interface MatchAttendance {
  id: string;
  player_id: string;
  player_name?: string;
  status: "present" | "absent" | "late" | "injured";
  notes: string | null;
}

export interface MatchPlayerStats {
  id: string;
  match_id: string;
  player_id: string;
  player_name?: string;
  goals: number;
  assists: number;
  minutes_played: number;
  weekly_minutes_played?: number;
  weekly_matches_played?: number;
  week_start?: string | null;
  week_end?: string | null;
  passes_completed?: number;
  pass_accuracy_percentage?: string | number | null;
  shots_total?: number;
  shots_on_target?: number;
  key_passes?: number;
  tackles?: number;
  defensive_tackles?: number;
  interceptions?: number;
  duels_won?: number;
  duels_lost?: number;
  possession_losses?: number;
  saves?: number;
  yellow_cards: number;
  red_cards: number;
  fouls?: number;
  injuries?: string | null;
  performance_rating: string | null;
  technical_rating?: string | number | null;
  tactical_rating?: string | number | null;
  physical_rating?: string | number | null;
  fatigue_rating?: string | number | null;
  mentality_rating?: string | number | null;
  decision_making_rating?: string | number | null;
  work_rate_rating?: string | number | null;
  positioning_rating?: string | number | null;
  strengths?: string | null;
  weaknesses?: string | null;
  improvement_plan?: string | null;
  coach_notes: string | null;
}

export interface RankingSystemInput {
  id: string;
  player_id: string;
  player_name?: string;
  week_start: string;
  week_end: string;
  position?: string | null;
  role_family: "attack" | "midfield" | "defense" | "goalkeeper" | "unknown";
  match_evaluation_count: number;
  training_evaluation_count: number;
  daily_ai_input_count: number;
  technical_rating: string | number | null;
  tactical_rating: string | number | null;
  physical_rating: string | number | null;
  mentality_rating: string | number | null;
  decision_making_rating: string | number | null;
  work_rate_rating: string | number | null;
  positioning_rating: string | number | null;
  shots_on_target: number;
  key_passes: number;
  goals: number;
  assists: number;
  pass_accuracy: string | number | null;
  duels: number;
  defensive_tackles: number;
  interceptions: number;
  saves: number;
  shot_stopping: string | number | null;
  distribution_accuracy: string | number | null;
  clean_sheets: number;
  handling_errors: number;
  sleep_hours: string | number | null;
  trained_today: string | number | null;
  meals_count: string | number | null;
  daily_ai_score: string | number | null;
  match_base_rating?: string | number | null;
  attendance_record_count: number;
  attendance_attended_count: number;
  attendance_score: string | number | null;
  coach_score: string | number | null;
  match_score: string | number | null;
  weekly_ai_score: string | number | null;
  weekly_score: string | number | null;
  grade: "A" | "B" | "C" | "D" | "F";
  trend: "New" | "Improving" | "Declining" | "Stable";
  rank: number;
  previous_rank: number | null;
  rank_change: number | null;
  score_delta: number | null;
  predicted_next_score: string | number | null;
  prediction_status: "ready" | "unavailable";
  model_version: string;
  model_error: string | null;
  model_input: {
    id: string;
    player_id: string;
    player_name?: string;
    match_score: number;
    coach_score: number;
    attendance_score: number;
    weekly_ai_score: number;
    position: string;
    trend: string;
    rank: number;
  } | null;
  final_api_response: {
    weekly_score: number | null;
    grade: "A" | "B" | "C" | "D" | "F";
    trend: "New" | "Improving" | "Declining" | "Stable";
    rank: number;
    predicted_next_score: number | null;
    carry_forward?: boolean;
    carried_from_week_start?: string | null;
  };
  carry_forward?: boolean;
  carried_from_week_start?: string | null;
  output: "match_score";
}

export interface MatchPlayerIncident {
  id: string;
  match_id: string;
  player_id: string;
  player_name?: string;
  incident_type: "yellow_card" | "red_card" | "injury";
  minute?: number;
  body_part: string | null;
  injury_date: string | null;
  notes: string | null;
  created_at: string;
}

export interface MatchGoalEvent {
  id: string;
  match_id: string;
  team: "our" | "opponent";
  scorer_player_id: string | null;
  scorer_player_name?: string | null;
  assist_player_id: string | null;
  assist_player_name?: string | null;
  minute: number;
  notes: string | null;
  created_at: string;
}

export interface MatchSubstitution {
  id: string;
  match_id: string;
  out_player_id: string;
  out_player_name?: string | null;
  in_player_id: string;
  in_player_name?: string | null;
  coach_id: string | null;
  coach_name?: string | null;
  minute: number;
  reason: string | null;
  created_at: string;
}

export interface MatchPostponement {
  id: string;
  match_id: string;
  previous_date: string;
  previous_time: string;
  new_date: string;
  new_time: string;
  previous_location: string | null;
  new_location: string | null;
  reason: string | null;
  postponed_by_user_id: string | null;
  created_at: string;
}

export interface FriendlyMatchRequest {
  id: string;
  coach_id: string;
  coach_name?: string;
  team_id: string | null;
  team_name?: string | null;
  birth_year_id?: string | null;
  birth_year_name?: string | null;
  preferred_date: string;
  preferred_time: string;
  opponent_level: "weak" | "medium" | "strong";
  suggested_opponent_name: string | null;
  reason: string;
  notes: string | null;
  status: "pending" | "approved" | "rejected";
  admin_response: string | null;
  converted_match_id: string | null;
  created_at: string;
}

export interface AdminCoachMatchRequest {
  id: string;
  coach_id: string;
  coach_name?: string;
  opponent_name: string;
  match_type: "official" | "friendly" | "training" | "training_match";
  match_date: string;
  match_time: string;
  location: string;
  venue_type: "home" | "away" | "neutral";
  referee_name: string | null;
  organizer_notes: string | null;
  status: "pending" | "accepted" | "expired" | "cancelled";
  expires_at: string;
  selected_group_id: string | null;
  selected_group_name?: string | null;
  selected_birth_year_id: string | null;
  selected_birth_year_name?: string | null;
  created_match_id: string | null;
  created_at: string;
}

export interface PlayerOption {
  id: string;
  field_key: "position";
  label: string;
  value: string;
  created_by_role: "admin" | "coach";
  is_active: boolean;
}

export interface CoachPlayer {
  id: string;
  full_name: string;
  date_of_birth: string | null;
  username?: string | null;
  phone?: string | null;
  account_phone?: string | null;
  level?: string | null;
  position: string | null;
  profile_status: "incomplete" | "complete";
  branch_id?: string | null;
  group_id: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  customProfile?: Array<{
    label: string;
    key: string;
    fieldType: string;
    value: unknown;
  }>;
}

export type PlayerProfile = CoachPlayer &
  Record<string, unknown> & {
    player_code?: string | null;
    photo_url?: string | null;
    branch_name?: string | null;
    group_name?: string | null;
    account_phone?: string | null;
    profile_completed_at?: string | null;
    date_joined?: string | null;
    created_at?: string | null;
    latestMeasurement?: Record<string, unknown> | null;
    height_cm?: string | number | null;
    weight_kg?: string | number | null;
  };

export interface PlayerAttendanceQr {
  playerId: string;
  playerName: string;
  playerCode: string | null;
  username: string | null;
  payload: string;
  qrCodeDataUrl: string;
}

export interface AttendanceQrScanResult {
  playerId: string;
  playerName: string;
  status: "present";
  arrivalTime?: string | null;
  alreadyMarked: boolean;
  attendance: TrainingAttendance | MatchAttendance;
}

export interface PlayerProgress {
  playerId: string;
  playerName: string;
  attendancePercentage: number;
  trainingAttendancePercentage?: number;
  matchAttendancePercentage?: number;
  trainingsAttended: number;
  trainingsRecorded?: number;
  matchesPlayed: number;
  matchesAttended?: number;
  matchesRecorded?: number;
  averageOverallRating?: number;
  averageTrainingRating: number;
  averageMatchRating: number;
  goals: number;
  assists: number;
  monthlyMinutesPlayed: number;
  monthlyMatchesPlayed: number;
  monthStart: string | null;
  monthEnd: string | null;
  weeklyMinutesPlayed: number;
  weeklyMatchesPlayed: number;
  weekStart: string | null;
  weekEnd: string | null;
  disciplineRecord: {
    yellowCards: number;
    redCards: number;
  };
  attendanceTotals?: {
    total: number;
    attended: number;
    trainingTotal: number;
    trainingAttended: number;
    matchTotal: number;
    matchAttended: number;
  };
  monthlyProgressSummary: string;
}

export interface ParentChild {
  id: string;
  full_name: string;
  player_code?: string | null;
  position?: string | null;
  level?: string | null;
  photo_url?: string | null;
  date_of_birth?: string | null;
  height_cm?: string | number | null;
  weight_kg?: string | number | null;
  preferred_foot?: "left" | "right" | "both" | string | null;
  profile_status?: string | null;
  branch_id?: string | null;
  branch_name?: string | null;
  group_id?: string | null;
  group_name?: string | null;
  relation?: string | null;
  is_primary?: boolean;
  can_view_progress?: boolean;
  can_view_payments?: boolean;
  can_message_coach?: boolean;
  coaches?: Array<{
    id: string;
    user_id: string;
    full_name: string;
    specialization?: string | null;
  }>;
}

export interface ParentPlayerNote {
  id: string;
  academy_id: string;
  parent_user_id: string;
  player_id: string;
  coach_user_id?: string | null;
  category: string;
  title?: string | null;
  body: string;
  visibility: "coach_only" | "parent_and_coach" | "player_and_parent" | "family";
  status: "new" | "reviewed" | "resolved";
  coach_response?: string | null;
  responded_by_user_id?: string | null;
  responded_at?: string | null;
  created_at: string;
  updated_at: string;
  player_name?: string | null;
  player_position?: string | null;
  parent_name?: string | null;
  coach_name?: string | null;
}

export interface ParentAiEvaluationInsight {
  player_id: string;
  analysis_id: string;
  input: Record<string, unknown> | null;
  result: Record<string, unknown> | null;
  model_version: string | null;
  created_at: string | null;
}

export interface ParentCoachEvaluationInsight {
  id: string;
  player_id: string;
  event_id: string;
  event_title?: string | null;
  event_type?: CalendarEventType | string | null;
  start_datetime?: string | null;
  coach_id?: string | null;
  coach_name?: string | null;
  overall_rating?: string | number | null;
  technical_rating?: string | number | null;
  tactical_rating?: string | number | null;
  physical_rating?: string | number | null;
  mentality_rating?: string | number | null;
  fatigue_rating?: string | number | null;
  coach_notes?: string | null;
  improvement_plan?: string | null;
  created_at?: string | null;
}

export interface ParentRankingInsight {
  id: string;
  player_id: string;
  group_id?: string | null;
  total_score: string | number | null;
  rank: number | null;
  period: string;
  trend: "up" | "down" | "same" | "new" | string;
  calculated_at: string | null;
  breakdown: {
    coach_eval_score: string | number | null;
    attendance_score: string | number | null;
    discipline_score: string | number | null;
    match_score: string | number | null;
    ai_score: string | number | null;
  };
}

export interface ParentAiInsights {
  injuryRisk: InjuryRiskPredictionRecord | null;
  aiEvaluation: ParentAiEvaluationInsight | null;
  coachEvaluation: ParentCoachEvaluationInsight | null;
  ranking: ParentRankingInsight | null;
}

export interface ParentDashboard {
  children: ParentChild[];
  selectedChild: ParentChild | null;
  progress: PlayerProgress | null;
  calendarEvents: PaginatedResponse<CalendarEvent>;
  trainings: PaginatedResponse<CalendarEvent>;
  matches: PaginatedResponse<Match>;
  attendance: PaginatedResponse<PlayerAttendanceRecord>;
  evaluations: PaginatedResponse<PlayerEvaluationRecord>;
  notes: PaginatedResponse<ParentPlayerNote>;
  coaches: Array<{
    id: string;
    user_id: string;
    full_name: string;
    specialization?: string | null;
  }>;
  payments?: ParentPaymentSummary | null;
  weeklyReport?: ParentWeeklyReport | null;
  aiInsights?: ParentAiInsights | null;
}

export interface AdminParentAccount {
  id: string;
  name?: string | null;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  username?: string | null;
  address?: string | null;
  is_active?: boolean;
  linked_players_count?: number;
  relationship?: string;
}

export interface AdminLinkablePlayer {
  id: string;
  full_name: string;
  player_code?: string | null;
  position?: string | null;
  level?: string | null;
  photo_url?: string | null;
  group_name?: string | null;
}

export interface AdminParentLink {
  id: string;
  academy_id: string;
  parent_user_id: string;
  player_id: string;
  relation: string;
  is_primary: boolean;
  can_view_progress: boolean;
  can_view_payments: boolean;
  can_message_coach: boolean;
  parent_name?: string | null;
  parent_email?: string | null;
  parent_phone?: string | null;
  player_name?: string | null;
  player_code?: string | null;
  position?: string | null;
  level?: string | null;
  group_name?: string | null;
  branch_name?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type ParentManagementRole = "admin" | "coach";

type ParentManagementQuery = {
  role: ParentManagementRole;
  page?: number;
  limit?: number;
  search?: string;
  parentUserId?: string;
  playerId?: string;
};

type ParentAccountInput = {
  fullName: string;
  username: string;
  password: string;
  phone: string;
  address: string;
  relationship: string;
};

type ParentLinkInput = {
  parentUserId: string;
  relation?: string;
  isPrimary?: boolean;
  canViewProgress?: boolean;
  canViewPayments?: boolean;
  canMessageCoach?: boolean;
};

type ParentManualLinkInput = ParentLinkInput & {
  playerId: string;
};

type ParentQrLinkInput = ParentLinkInput & {
  payload?: string;
  playerId?: string;
  playerCode?: string;
  username?: string;
};

export interface ParentMeasurement {
  id: string;
  player_id: string;
  height_cm?: string | number | null;
  weight_kg?: string | number | null;
  bmi?: string | number | null;
  sprint_speed?: string | number | null;
  stamina?: number | null;
  flexibility?: number | null;
  measured_at: string;
  measured_by?: string | null;
  measured_by_name?: string | null;
  notes?: string | null;
}

export interface ParentPaymentInvoice {
  id: string;
  subscription_id: string;
  amount: string | number;
  due_date: string;
  paid_at?: string | null;
  status: "pending" | "paid" | "overdue" | "cancelled";
  plan?: "monthly" | "quarterly" | "yearly" | string;
  currency?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  created_at?: string;
}

export interface ParentPaymentSubscription {
  id: string;
  player_id: string;
  group_id?: string | null;
  group_name?: string | null;
  plan: "monthly" | "quarterly" | "yearly" | string;
  amount: string | number;
  currency?: string | null;
  starts_at: string;
  ends_at: string;
  status: "active" | "expired" | "cancelled" | "pending";
  discount_amount?: string | number | null;
  penalty_amount?: string | number | null;
  last_payment_date?: string | null;
  next_payment_due?: string | null;
}

export interface ParentPaymentSummary {
  currentSubscription: ParentPaymentSubscription | null;
  subscriptions: ParentPaymentSubscription[];
  invoices: ParentPaymentInvoice[];
  totals: {
    total: number;
    paid: number;
    due: number;
    byStatus: Record<string, number>;
  };
}

export interface ParentWeeklyReport {
  generatedAt: string;
  progress: PlayerProgress | null;
  attendanceRate: number;
  latestEvaluation: PlayerEvaluationRecord | null;
  upcomingTrainings: CalendarEvent[];
  recentMatches: Match[];
  recentNotes: ParentPlayerNote[];
  highlights: string[];
  actionItems: string[];
}

export interface PlayerAttendanceRecord {
  id: string;
  record_type?: "training" | "match";
  source_id?: string;
  event_id?: string | null;
  match_id?: string | null;
  player_id: string;
  player_name?: string;
  status: TrainingAttendance["status"] | MatchAttendance["status"];
  arrival_time?: string | null;
  reason?: string | null;
  notes: string | null;
  title?: string;
  event_type?: CalendarEventType;
  start_datetime?: string;
  opponent_name?: string | null;
  match_date?: string | null;
  match_time?: string | null;
  location?: string | null;
  inferred_absence?: boolean;
}

export type PlayerEvaluationRecord = TrainingEvaluation & {
  title?: string;
  event_type?: CalendarEventType;
  start_datetime?: string;
};

export interface NotificationRow {
  id: string;
  title: string;
  body: string;
  type: string;
  data?: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
}

export interface InjuryRiskPainDiscomfortRecord {
  id: string | null;
  player_id: string;
  player_name: string;
  position: string | null;
  group_id: string | null;
  week_start: string;
  week_end: string;
  pain_or_discomfort: 0 | 1 | null;
  recorded_by_coach_id: string | null;
  updated_at: string | null;
}

export interface InjuryRiskModelInput {
  player_id: string;
  player_name: string;
  age: number | null;
  position: string;
  attendance_rate: number;
  training_sessions_per_week: number;
  match_minutes_last_week: number;
  fatigue_rating: number;
  previous_injury: number;
  pain_or_discomfort: number;
}

export interface InjuryRiskPrediction {
  risk_percentage: number;
  risk_level: "Low" | "Medium" | "High" | string;
  alert_flag: boolean;
  recommendation: string;
}

export interface InjuryRiskPredictionRecord {
  player_id: string;
  player_name: string;
  position: string | null;
  group_id: string | null;
  analysis_id: string | null;
  input: InjuryRiskModelInput | null;
  prediction: InjuryRiskPrediction | null;
  model_version: string | null;
  created_at: string | null;
  error?: string | null;
}

export interface CoachPlayerDetail {
  player: CoachPlayer &
    Record<string, unknown> & {
      player_code?: string | null;
      photo_url?: string | null;
      branch_name?: string | null;
      group_name?: string | null;
      account_phone?: string | null;
      account_is_active?: boolean | null;
      profile_completed_at?: string | null;
      date_joined?: string | null;
      created_at?: string | null;
      linked_parent?: {
        link_id: string;
        user_id: string;
        name: string | null;
        full_name?: string | null;
        username: string | null;
        email: string | null;
        phone: string | null;
        address: string | null;
        relation: string | null;
        is_primary: boolean;
        is_active: boolean;
        can_view_progress: boolean;
        can_view_payments: boolean;
        can_message_coach: boolean;
      } | null;
    };
  summary: {
    matchTotals: {
      matches_played: number;
      minutes_played: number;
      goals: number;
      assists: number;
      yellow_cards: number;
      red_cards: number;
    };
    attendanceTotals: Record<string, number>;
    trainingEvaluationCount: number;
    injuryCount: number;
    latestMeasurement: Record<string, unknown> | null;
    latestRanking: Record<string, unknown> | null;
  };
  customProfile: Array<Record<string, unknown> & { label: string; value: unknown }>;
  groups: Record<string, unknown>[];
  measurements: Record<string, unknown>[];
  injuries: Record<string, unknown>[];
  healthProfile: Record<string, unknown> | null;
  skillAssessments: Record<string, unknown>[];
  trainingSummaries: Record<string, unknown>[];
  matchSummaries: Record<string, unknown>[];
  trainingAttendance: Record<string, unknown>[];
  trainingEvaluations: Record<string, unknown>[];
  matchStats: Array<MatchPlayerStats & Record<string, unknown>>;
  matchAttendance: Record<string, unknown>[];
  substitutions: MatchSubstitution[];
  incidents: MatchPlayerIncident[];
  goals: MatchGoalEvent[];
  rankings: Record<string, unknown>[];
  coachRatings: Record<string, unknown>[];
  playerAssignments: PlayerAssignment[];
  injuryRisk: InjuryRiskPredictionRecord | null;
  attendanceQr?: PlayerAttendanceQr | null;
  payments: {
    subscriptions: Record<string, unknown>[];
    invoices: Record<string, unknown>[];
    transactions: Record<string, unknown>[];
  };
}

export interface ManagedParentProfile {
  parent: AdminParentAccount;
  links: AdminParentLink[];
  children: CoachPlayerDetail[];
}

export interface TrainingAttendance {
  id: string;
  event_id: string;
  player_id: string;
  player_name?: string;
  status: "present" | "absent" | "late" | "excused" | "injured";
  arrival_time: string | null;
  reason: string | null;
  notes: string | null;
}

export interface TrainingEvaluation {
  id: string;
  event_id: string;
  player_id: string;
  player_name?: string;
  overall_rating: string | number | null;
  technical_rating: string | number | null;
  tactical_rating: string | number | null;
  physical_rating: string | number | null;
  fatigue_rating?: string | number | null;
  mentality_rating: string | number | null;
  discipline_rating: string | number | null;
  teamwork_rating: string | number | null;
  impact_rating: string | number | null;
  ball_control_rating?: string | number | null;
  passing_accuracy_rating?: string | number | null;
  shooting_rating?: string | number | null;
  dribbling_rating?: string | number | null;
  receiving_under_pressure_rating?: string | number | null;
  speed_rating?: string | number | null;
  endurance_rating?: string | number | null;
  strength_rating?: string | number | null;
  agility_rating?: string | number | null;
  strengths: string | null;
  weaknesses: string | null;
  coach_notes: string | null;
  improvement_plan: string | null;
  development_notes?: string | null;
  visibility: "private" | "player_and_parent" | "admin_only";
}

export interface TrainingParticipant extends CoachPlayer {
  player_code?: string | null;
  full_name: string;
  group_name?: string | null;
  attendance: TrainingAttendance | null;
  evaluation: TrainingEvaluation | null;
  customProfile: Array<{
    label: string;
    key: string;
    fieldType: string;
    value: unknown;
  }>;
  totals: {
    attendance: {
      total: number;
      present: number;
      late: number;
      absent: number;
      injured: number;
    };
    matches: {
      matches_played: number;
      minutes_played: number;
      goals: number;
      assists: number;
      average_rating: string | number | null;
      pass_accuracy_percentage: string | number | null;
      tackles: number;
    };
    injuries: number;
  };
  monthlyProgress: Array<{
    month: string;
    average_rating: string | number | null;
  }>;
}

export interface CoachGroup {
  group_id: string;
  group_name: string;
  branch_id: string;
  branch_name: string;
  role: string;
  can_create_training: boolean;
  can_take_attendance: boolean;
  can_evaluate_players: boolean;
  can_record_measurements: boolean;
  can_manage_player_assignments: boolean;
  can_manage_players: boolean;
  can_manage_groups: boolean;
  can_manage_matches: boolean;
  can_view_injury_risk: boolean;
  can_run_injury_risk: boolean;
  can_manage_injury_risk: boolean;
}

export type CoachPermission = keyof Pick<
  CoachGroup,
  | "can_create_training"
  | "can_take_attendance"
  | "can_evaluate_players"
  | "can_record_measurements"
  | "can_manage_player_assignments"
  | "can_manage_players"
  | "can_manage_groups"
  | "can_manage_matches"
  | "can_view_injury_risk"
  | "can_run_injury_risk"
  | "can_manage_injury_risk"
>;

export type CoachPermissions = Record<CoachPermission, boolean>;

export type CustomFieldType =
  | "text"
  | "long_text"
  | "number"
  | "decimal"
  | "date"
  | "time"
  | "boolean"
  | "single_select"
  | "multi_select"
  | "rating"
  | "percentage"
  | "file"
  | "image"
  | "url"
  | "phone"
  | "email";

export interface CustomFieldOption {
  id: string;
  field_id: string;
  label: string;
  value: string;
  created_by_role: "admin" | "coach";
  is_active: boolean;
  sort_order: number;
}

export interface CustomField {
  id: string;
  category_id: string;
  label: string;
  key: string;
  field_type: CustomFieldType;
  is_required: boolean;
  placeholder: string | null;
  default_value: string | null;
  unit: string | null;
  min_value: string | number | null;
  max_value: string | number | null;
  created_by_role: "admin" | "coach";
  is_active: boolean;
  sort_order: number;
  options: CustomFieldOption[];
}

export interface CustomCategory {
  id: string;
  name: string;
  description: string | null;
  target_module:
    | "player_profile"
    | "training"
    | "match"
    | "injury"
    | "payment"
    | "evaluation";
  created_by_role: "admin" | "coach";
  created_by_coach_id: string | null;
  assigned_coach_id: string | null;
  visibility: "global" | "specific_coach" | "coach_only" | "shared";
  is_editable_by_coach: boolean;
  is_system_default: boolean;
  is_active: boolean;
  sort_order: number;
  fields: CustomField[];
}

export interface PlayerCustomProfile {
  categories: CustomCategory[];
  values: Array<{ field_id: string; value: unknown }>;
  missingRequiredFieldIds: string[];
}

export interface PlayerAssignmentUpload {
  fileType: "pdf" | "word" | "image";
  fileName: string;
  fileUrl: string;
  mimeType?: string;
  sizeBytes?: number;
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
  assignmentId?: string;
  playerId: string;
  notes?: string;
  submittedAt: string;
  reviewStatus?: "pending" | "approved" | "rejected";
  coachComment?: string;
  reviewedAt?: string | null;
  files?: PlayerAssignmentFile[];
  inputDate?: string;
  sleepHours?: number;
  trainedToday?: number;
  mealsCount?: number;
  dailyAiScore?: number;
}

export interface PlayerAssignment {
  id: string;
  assignmentType: "daily_ai" | "coach_task";
  title: string;
  description: string;
  coachName?: string | null;
  openAt: string | null;
  dueAt: string | null;
  status: "active" | "closed" | "cancelled";
  isSystemDaily: boolean;
  acceptedFileTypes: Array<"pdf" | "word" | "image">;
  groups: Array<{ id: string; name: string; branchName?: string | null }>;
  submission: PlayerAssignmentSubmission | null;
  scoringRules?: Record<string, string[] | string>;
  playerStatus?: "not_submitted" | "submitted" | "approved" | "rejected";
  submittedAt?: string | null;
  reviewStatus?: "pending" | "approved" | "rejected" | null;
  filesCount?: number;
}

export interface DailyAiSubmitInput {
  sleepHours: number;
  trainedToday: 0 | 1;
  mealsCount: number;
}

export const calendarApi = createApi({
  reducerPath: "calendarApi",
  baseQuery: baseQueryWithReauth,
  keepUnusedDataFor: 300,
  tagTypes: [
    "CalendarEvents",
    "Matches",
    "FriendlyRequests",
    "CoachGroups",
    "CoachPlayers",
    "PlayerOptions",
    "CustomData",
    "PlayerCustomProfile",
    "Reports",
    "InjuryRiskInputs",
    "Notifications",
    "EvaluationEditRequests",
    "PlayerAssignments",
    "ParentPortal",
    "ParentLinks",
  ],
  endpoints: (builder) => ({
    getAdminCalendarEvents: builder.query<
      PaginatedResponse<CalendarEvent>,
      Record<string, string | number | undefined> | void
    >({
      query: (args) => {
        const filters = args ?? {};
        const params = new URLSearchParams({
          page: String(filters.page ?? 1),
          limit: String(filters.limit ?? 100),
        });
        for (const [key, value] of Object.entries(filters))
          if (value && key !== "page" && key !== "limit")
            params.set(key, String(value));
        return `/admin/calendar-events?${params}`;
      },
      transformResponse: (res: ApiListResponse<CalendarEvent>) =>
        toPaginated(res),
      providesTags: ["CalendarEvents"],
    }),
    createAdminCalendarEvent: builder.mutation<
      CalendarEvent,
      Record<string, unknown>
    >({
      query: (body) => ({
        url: "/admin/calendar-events",
        method: "POST",
        body,
      }),
      transformResponse: (res: { data: CalendarEvent }) => res.data,
      invalidatesTags: ["CalendarEvents"],
    }),
    hardDeleteAdminTrainingEvent: builder.mutation<
      { message: string; affectedPlayers: number },
      string
    >({
      query: (id) => ({
        url: `/admin/calendar-events/${id}/hard-delete-training`,
        method: "DELETE",
      }),
      transformResponse: (res: {
        data: { message: string; affectedPlayers: number };
      }) => res.data,
      invalidatesTags: [
        "CalendarEvents",
        "CoachPlayers",
        "Reports",
        "InjuryRiskInputs",
        "Notifications",
      ],
    }),
    getAdminMatches: builder.query<
      PaginatedResponse<Match>,
      Record<string, string | number | undefined> | void
    >({
      query: (args) => {
        const filters = args ?? {};
        const params = new URLSearchParams({
          page: String(filters.page ?? 1),
          limit: String(filters.limit ?? 100),
        });
        for (const [key, value] of Object.entries(filters))
          if (value && key !== "page" && key !== "limit")
            params.set(key, String(value));
        return `/admin/matches?${params}`;
      },
      transformResponse: (res: ApiListResponse<Match>) => toPaginated(res),
      providesTags: ["Matches"],
    }),
    getAdminMatch: builder.query<Match, string>({
      query: (id) => `/admin/matches/${id}`,
      transformResponse: (res: { data: Match }) => res.data,
      providesTags: ["Matches"],
    }),
    createAdminMatch: builder.mutation<Match, Record<string, unknown>>({
      query: (body) => ({ url: "/admin/matches", method: "POST", body }),
      transformResponse: (res: { data: Match }) => res.data,
      invalidatesTags: ["Matches", "CalendarEvents"],
    }),
    getAdminCoachMatchRequests: builder.query<
      PaginatedResponse<AdminCoachMatchRequest>,
      void
    >({
      query: () => "/admin/match-coach-requests?limit=100",
      transformResponse: (res: ApiListResponse<AdminCoachMatchRequest>) =>
        toPaginated(res),
      providesTags: ["FriendlyRequests"],
    }),
    createAdminCoachMatchRequest: builder.mutation<
      AdminCoachMatchRequest,
      Record<string, unknown>
    >({
      query: (body) => ({
        url: "/admin/match-coach-requests",
        method: "POST",
        body,
      }),
      transformResponse: (res: { data: AdminCoachMatchRequest }) => res.data,
      invalidatesTags: ["FriendlyRequests"],
    }),
    getAdminEvaluationEditRequests: builder.query<
      PaginatedResponse<MatchEvaluationEditRequest>,
      { status?: MatchEvaluationEditRequest["status"]; page?: number; limit?: number } | void
    >({
      query: (args) => {
        const params = new URLSearchParams({
          page: String(args?.page ?? 1),
          limit: String(args?.limit ?? 100),
        });
        if (args?.status) params.set("status", args.status);
        return `/admin/evaluation-edit-requests?${params}`;
      },
      transformResponse: (res: ApiListResponse<MatchEvaluationEditRequest>) =>
        toPaginated(res),
      providesTags: ["EvaluationEditRequests"],
    }),
    approveEvaluationEditRequest: builder.mutation<
      MatchEvaluationEditRequest,
      { id: string; adminResponse?: string }
    >({
      query: ({ id, adminResponse }) => ({
        url: `/admin/evaluation-edit-requests/${id}/approve`,
        method: "PATCH",
        body: { adminResponse },
      }),
      transformResponse: (res: { data: MatchEvaluationEditRequest }) => res.data,
      invalidatesTags: ["EvaluationEditRequests", "Matches", "Notifications"],
    }),
    rejectEvaluationEditRequest: builder.mutation<
      MatchEvaluationEditRequest,
      { id: string; adminResponse?: string }
    >({
      query: ({ id, adminResponse }) => ({
        url: `/admin/evaluation-edit-requests/${id}/reject`,
        method: "PATCH",
        body: { adminResponse },
      }),
      transformResponse: (res: { data: MatchEvaluationEditRequest }) => res.data,
      invalidatesTags: ["EvaluationEditRequests", "Notifications"],
    }),
    updateAdminMatch: builder.mutation<
      Match,
      { id: string; body: Record<string, unknown> }
    >({
      query: ({ id, body }) => ({
        url: `/admin/matches/${id}`,
        method: "PATCH",
        body,
      }),
      transformResponse: (res: { data: Match }) => res.data,
      invalidatesTags: ["Matches", "CalendarEvents"],
    }),
    updateAdminMatchStatus: builder.mutation<
      Match,
      { id: string; status: MatchStatus }
    >({
      query: ({ id, status }) => ({
        url: `/admin/matches/${id}/status`,
        method: "PATCH",
        body: { status },
      }),
      transformResponse: (res: { data: Match }) => res.data,
      invalidatesTags: ["Matches", "CalendarEvents"],
    }),
    postponeAdminMatch: builder.mutation<
      Match,
      {
        id: string;
        body: {
          matchDate: string;
          matchTime: string;
          location?: string | null;
          reason?: string;
        };
      }
    >({
      query: ({ id, body }) => ({
        url: `/admin/matches/${id}/postpone`,
        method: "PATCH",
        body,
      }),
      transformResponse: (res: { data: Match }) => res.data,
      invalidatesTags: ["Matches", "CalendarEvents"],
    }),
    deleteAdminMatch: builder.mutation<void, string>({
      query: (id) => ({ url: `/admin/matches/${id}`, method: "DELETE" }),
      invalidatesTags: ["Matches", "CalendarEvents"],
    }),
    hardDeleteAdminMatch: builder.mutation<void, string>({
      query: (id) => ({
        url: `/admin/matches/${id}/hard-delete`,
        method: "DELETE",
      }),
      invalidatesTags: ["Matches", "CalendarEvents", "FriendlyRequests"],
    }),
    getAdminFriendlyRequests: builder.query<
      PaginatedResponse<FriendlyMatchRequest>,
      void
    >({
      query: () => "/admin/friendly-match-requests?limit=100",
      transformResponse: (res: ApiListResponse<FriendlyMatchRequest>) =>
        toPaginated(res),
      providesTags: ["FriendlyRequests"],
    }),
    approveFriendlyRequest: builder.mutation<
      FriendlyMatchRequest,
      { id: string; adminResponse?: string }
    >({
      query: ({ id, adminResponse }) => ({
        url: `/admin/friendly-match-requests/${id}/approve`,
        method: "PATCH",
        body: { adminResponse },
      }),
      transformResponse: (res: { data: FriendlyMatchRequest }) => res.data,
      invalidatesTags: ["FriendlyRequests"],
    }),
    rejectFriendlyRequest: builder.mutation<
      FriendlyMatchRequest,
      { id: string; adminResponse: string }
    >({
      query: ({ id, adminResponse }) => ({
        url: `/admin/friendly-match-requests/${id}/reject`,
        method: "PATCH",
        body: { adminResponse },
      }),
      transformResponse: (res: { data: FriendlyMatchRequest }) => res.data,
      invalidatesTags: ["FriendlyRequests"],
    }),
    convertFriendlyRequest: builder.mutation<
      Match,
      { id: string; body: Record<string, unknown> }
    >({
      query: ({ id, body }) => ({
        url: `/admin/friendly-match-requests/${id}/convert-to-match`,
        method: "POST",
        body,
      }),
      transformResponse: (res: { data: Match }) => res.data,
      invalidatesTags: ["FriendlyRequests", "Matches", "CalendarEvents"],
    }),
    getCoachCalendarEvents: builder.query<
      PaginatedResponse<CalendarEvent>,
      void
    >({
      query: () => "/coach/calendar-events?limit=100",
      transformResponse: (res: ApiListResponse<CalendarEvent>) =>
        toPaginated(res),
      providesTags: ["CalendarEvents"],
    }),
    getCoachGroupsScoped: builder.query<CoachGroup[], void>({
      query: () => "/coach/groups",
      transformResponse: (res: { data: CoachGroup[] }) => res.data,
      providesTags: ["CoachGroups"],
    }),
    getCoachPermissions: builder.query<CoachPermissions, void>({
      query: () => "/coach/permissions",
      transformResponse: (res: { data: CoachPermissions }) => res.data,
      providesTags: ["CoachGroups"],
      keepUnusedDataFor: 60,
    }),
    getCoachPlayersScoped: builder.query<
      PaginatedResponse<CoachPlayer>,
      {
        page?: number;
        limit?: number;
        customFieldId?: string;
        customValue?: string;
        customOptionId?: string;
      } | void
    >({
      query: (args) => {
        const params = new URLSearchParams({
          page: String(args?.page ?? 1),
          limit: String(args?.limit ?? 200),
        });
        if (args?.customFieldId)
          params.set("customFieldId", args.customFieldId);
        if (args?.customValue) params.set("customValue", args.customValue);
        if (args?.customOptionId)
          params.set("customOptionId", args.customOptionId);
        return `/coach/players?${params}`;
      },
      transformResponse: (res: ApiListResponse<CoachPlayer>) =>
        toPaginated(res),
      providesTags: ["CoachPlayers"],
    }),
    getCoachPlayerDetail: builder.query<CoachPlayerDetail, string>({
      query: (id) => `/coach/players/${id}`,
      transformResponse: (res: { data: CoachPlayerDetail }) => res.data,
      providesTags: ["CoachPlayers", "Matches", "CalendarEvents"],
    }),
    getManagedPlayerDetail: builder.query<
      CoachPlayerDetail,
      { role: ParentManagementRole; id: string }
    >({
      query: ({ role, id }) =>
        role === "admin" ? `/admin/players/${id}/detail` : `/coach/players/${id}`,
      transformResponse: (res: { data: CoachPlayerDetail }) => res.data,
      providesTags: ["CoachPlayers", "Matches", "CalendarEvents"],
    }),
    getInjuryRiskPainDiscomfort: builder.query<
      InjuryRiskPainDiscomfortRecord[],
      void
    >({
      query: () => "/coach/injury-risk/pain-discomfort",
      transformResponse: (res: { data: InjuryRiskPainDiscomfortRecord[] }) =>
        res.data,
      providesTags: ["InjuryRiskInputs"],
    }),
    upsertInjuryRiskPainDiscomfort: builder.mutation<
      InjuryRiskPainDiscomfortRecord[],
      { records: Array<{ playerId: string; painOrDiscomfort: 0 | 1 }> }
    >({
      query: (body) => ({
        url: "/coach/injury-risk/pain-discomfort",
        method: "POST",
        body,
      }),
      transformResponse: (res: { data: InjuryRiskPainDiscomfortRecord[] }) =>
        res.data,
      invalidatesTags: ["InjuryRiskInputs"],
    }),
    getInjuryRiskPredictions: builder.query<
      InjuryRiskPredictionRecord[],
      void
    >({
      query: () => "/coach/injury-risk/predictions",
      transformResponse: (res: { data: InjuryRiskPredictionRecord[] }) =>
        res.data,
      providesTags: ["InjuryRiskInputs"],
    }),
    runInjuryRiskPredictions: builder.mutation<
      InjuryRiskPredictionRecord[],
      void
    >({
      query: () => ({
        url: "/coach/injury-risk/predictions/run",
        method: "POST",
      }),
      transformResponse: (res: { data: InjuryRiskPredictionRecord[] }) =>
        res.data,
      invalidatesTags: ["InjuryRiskInputs"],
    }),
    createCoachBasicPlayer: builder.mutation<
      CoachPlayer,
      Record<string, unknown>
    >({
      query: (body) => ({ url: "/coach/players", method: "POST", body }),
      transformResponse: (res: { data: CoachPlayer }) => res.data,
      invalidatesTags: ["CoachPlayers"],
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
      invalidatesTags: ["CoachPlayers"],
    }),
    completeCoachPlayerProfile: builder.mutation<
      CoachPlayer,
      { id: string; body: Record<string, unknown> }
    >({
      query: ({ id, body }) => ({
        url: `/coach/players/${id}/complete-profile`,
        method: "PATCH",
        body,
      }),
      transformResponse: (res: { data: CoachPlayer }) => res.data,
      invalidatesTags: ["CoachPlayers"],
    }),
    createCoachTrainingEvent: builder.mutation<
      CalendarEvent,
      Record<string, unknown>
    >({
      query: (body) => ({
        url: "/coach/training-events",
        method: "POST",
        body,
      }),
      transformResponse: (res: { data: CalendarEvent }) => res.data,
      invalidatesTags: ["CalendarEvents"],
    }),
    getCoachTrainingEvent: builder.query<CalendarEvent, string>({
      query: (id) => `/coach/training-events/${id}`,
      transformResponse: (res: { data: CalendarEvent }) => res.data,
      providesTags: ["CalendarEvents"],
    }),
    updateCoachTrainingStatus: builder.mutation<
      CalendarEvent,
      {
        id: string;
        status: CalendarEventStatus;
      }
    >({
      query: ({ id, status }) => ({
        url: `/coach/training-events/${id}/status`,
        method: "PATCH",
        body: { status },
      }),
      transformResponse: (res: { data: CalendarEvent }) => res.data,
      invalidatesTags: ["CalendarEvents"],
    }),
    extendCoachTrainingEvent: builder.mutation<
      CalendarEvent,
      { id: string; minutes: number }
    >({
      query: ({ id, minutes }) => ({
        url: `/coach/training-events/${id}/extend`,
        method: "PATCH",
        body: { minutes },
      }),
      transformResponse: (res: { data: CalendarEvent }) => res.data,
      invalidatesTags: ["CalendarEvents"],
    }),
    upsertTrainingAttendance: builder.mutation<
      TrainingAttendance[],
      { eventId: string; records: Record<string, unknown>[] }
    >({
      query: ({ eventId, records }) => ({
        url: `/coach/events/${eventId}/attendance`,
        method: "POST",
        body: { records },
      }),
      transformResponse: (res: { data: TrainingAttendance[] }) => res.data,
      invalidatesTags: ["CalendarEvents"],
    }),
    scanTrainingAttendanceQr: builder.mutation<
      AttendanceQrScanResult,
      { eventId: string; payload: string }
    >({
      query: ({ eventId, payload }) => ({
        url: `/coach/events/${eventId}/attendance/qr-scan`,
        method: "POST",
        body: { payload },
      }),
      transformResponse: (res: { data: AttendanceQrScanResult }) => res.data,
      invalidatesTags: ["CalendarEvents", "Notifications"],
    }),
    upsertTrainingEvaluations: builder.mutation<
      TrainingEvaluation[],
      { eventId: string; records: Record<string, unknown>[] }
    >({
      query: ({ eventId, records }) => ({
        url: `/coach/events/${eventId}/evaluations`,
        method: "POST",
        body: { records },
      }),
      transformResponse: (res: { data: TrainingEvaluation[] }) => res.data,
      invalidatesTags: ["CalendarEvents", "Notifications"],
    }),
    getCoachMatches: builder.query<PaginatedResponse<Match>, void>({
      query: () => "/coach/matches?limit=100",
      transformResponse: (res: ApiListResponse<Match>) => toPaginated(res),
      providesTags: ["Matches"],
    }),
    getCoachMatch: builder.query<Match, string>({
      query: (id) => `/coach/matches/${id}`,
      transformResponse: (res: { data: Match }) => res.data,
      providesTags: ["Matches"],
    }),
    getCoachRankingSystemInputs: builder.query<
      PaginatedResponse<RankingSystemInput>,
      { groupId?: string; page?: number; limit?: number } | void
    >({
      query: (args) => {
        const params = new URLSearchParams({
          page: String(args?.page ?? 1),
          limit: String(args?.limit ?? 100),
        });
        if (args?.groupId) params.set("groupId", args.groupId);
        return `/coach/ranking-system-inputs?${params}`;
      },
      transformResponse: (res: ApiListResponse<RankingSystemInput>) =>
        toPaginated(res),
      providesTags: ["Matches"],
    }),
    getPlayerRankingSystemInputs: builder.query<
      PaginatedResponse<RankingSystemInput>,
      { groupId?: string; page?: number; limit?: number } | void
    >({
      query: (args) => {
        const params = new URLSearchParams({
          page: String(args?.page ?? 1),
          limit: String(args?.limit ?? 100),
        });
        if (args?.groupId) params.set("groupId", args.groupId);
        return `/player/ranking-system-inputs?${params}`;
      },
      transformResponse: (res: ApiListResponse<RankingSystemInput>) =>
        toPaginated(res),
      providesTags: ["Matches"],
    }),
    getParentRankingSystemInputs: builder.query<
      PaginatedResponse<RankingSystemInput>,
      { childId?: string; page?: number; limit?: number } | void
    >({
      query: (args) => {
        const params = new URLSearchParams({
          page: String(args?.page ?? 1),
          limit: String(args?.limit ?? 100),
        });
        if (args?.childId) params.set("childId", args.childId);
        return `/parent/ranking-system-inputs?${params}`;
      },
      transformResponse: (res: ApiListResponse<RankingSystemInput>) =>
        toPaginated(res),
      providesTags: ["Matches"],
    }),
    requestMatchEvaluationEdit: builder.mutation<
      MatchEvaluationEditRequest,
      { matchId: string; reason?: string }
    >({
      query: ({ matchId, reason }) => ({
        url: `/coach/matches/${matchId}/evaluation-edit-requests`,
        method: "POST",
        body: { reason },
      }),
      transformResponse: (res: { data: MatchEvaluationEditRequest }) => res.data,
      invalidatesTags: ["Matches", "EvaluationEditRequests", "Notifications"],
    }),
    upsertMatchSquad: builder.mutation<
      MatchSquad[],
      { matchId: string; players: Record<string, unknown>[] }
    >({
      query: ({ matchId, players }) => ({
        url: `/coach/matches/${matchId}/squad`,
        method: "POST",
        body: { players },
      }),
      transformResponse: (res: { data: MatchSquad[] }) => res.data,
      invalidatesTags: ["Matches"],
    }),
    updateMatchSquadPlayer: builder.mutation<
      MatchSquad,
      { matchId: string; playerId: string; body: Record<string, unknown> }
    >({
      query: ({ matchId, playerId, body }) => ({
        url: `/coach/matches/${matchId}/squad/${playerId}`,
        method: "PATCH",
        body,
      }),
      transformResponse: (res: { data: MatchSquad }) => res.data,
      invalidatesTags: ["Matches"],
    }),
    deleteMatchSquadPlayer: builder.mutation<
      { message: string },
      { matchId: string; playerId: string }
    >({
      query: ({ matchId, playerId }) => ({
        url: `/coach/matches/${matchId}/squad/${playerId}`,
        method: "DELETE",
      }),
      transformResponse: (res: { data: { message: string } }) => res.data,
      invalidatesTags: ["Matches"],
    }),
    upsertMatchTactics: builder.mutation<
      MatchTactics,
      { matchId: string; body: Record<string, unknown> }
    >({
      query: ({ matchId, body }) => ({
        url: `/coach/matches/${matchId}/tactics`,
        method: "POST",
        body,
      }),
      transformResponse: (res: { data: MatchTactics }) => res.data,
      invalidatesTags: ["Matches"],
    }),
    updateCoachMatchTargets: builder.mutation<
      Match,
      { matchId: string; body: { groupId?: string; birthYearId?: string } }
    >({
      query: ({ matchId, body }) => ({
        url: `/coach/matches/${matchId}/targets`,
        method: "PATCH",
        body,
      }),
      transformResponse: (res: { data: Match }) => res.data,
      invalidatesTags: ["Matches", "CalendarEvents"],
    }),
    updateMatchLiveStatus: builder.mutation<
      Match,
      {
        matchId: string;
        body: {
          matchStatus: "scheduled" | "first_half" | "second_half" | "finished";
          firstHalfStoppageMinutes?: number;
          secondHalfStoppageMinutes?: number;
        };
      }
    >({
      query: ({ matchId, body }) => ({
        url: `/coach/matches/${matchId}/live-status`,
        method: "PATCH",
        body,
      }),
      transformResponse: (res: { data: Match }) => res.data,
      invalidatesTags: ["Matches", "CalendarEvents"],
    }),
    recordMatchIncident: builder.mutation<
      MatchPlayerIncident,
      {
        matchId: string;
        body: {
          playerId: string;
          incidentType: "yellow_card" | "red_card" | "injury";
          minute?: number;
          bodyPart?: string;
          notes?: string;
        };
      }
    >({
      query: ({ matchId, body }) => ({
        url: `/coach/matches/${matchId}/incidents`,
        method: "POST",
        body,
      }),
      transformResponse: (res: { data: MatchPlayerIncident }) => res.data,
      invalidatesTags: ["Matches"],
    }),
    recordMatchGoal: builder.mutation<
      Match,
      {
        matchId: string;
        body: {
          team: "our" | "opponent";
          scorerPlayerId?: string;
          assistPlayerId?: string;
          minute?: number;
          notes?: string;
        };
      }
    >({
      query: ({ matchId, body }) => ({
        url: `/coach/matches/${matchId}/goals`,
        method: "POST",
        body,
      }),
      transformResponse: (res: { data: Match }) => res.data,
      invalidatesTags: ["Matches"],
    }),
    deleteMatchGoal: builder.mutation<
      Match,
      { matchId: string; goalId: string }
    >({
      query: ({ matchId, goalId }) => ({
        url: `/coach/matches/${matchId}/goals/${goalId}`,
        method: "DELETE",
      }),
      transformResponse: (res: { data: Match }) => res.data,
      invalidatesTags: ["Matches"],
    }),
    recordMatchSubstitution: builder.mutation<
      Match,
      {
        matchId: string;
        body: {
          outPlayerId: string;
          inPlayerId: string;
          minute?: number;
          reason?: string;
        };
      }
    >({
      query: ({ matchId, body }) => ({
        url: `/coach/matches/${matchId}/substitutions`,
        method: "POST",
        body,
      }),
      transformResponse: (res: { data: Match }) => res.data,
      invalidatesTags: ["Matches"],
    }),
    deleteMatchSubstitution: builder.mutation<
      Match,
      { matchId: string; substitutionId: string }
    >({
      query: ({ matchId, substitutionId }) => ({
        url: `/coach/matches/${matchId}/substitutions/${substitutionId}`,
        method: "DELETE",
      }),
      transformResponse: (res: { data: Match }) => res.data,
      invalidatesTags: ["Matches"],
    }),
    deleteMatchIncident: builder.mutation<
      Match,
      { matchId: string; incidentId: string }
    >({
      query: ({ matchId, incidentId }) => ({
        url: `/coach/matches/${matchId}/incidents/${incidentId}`,
        method: "DELETE",
      }),
      transformResponse: (res: { data: Match }) => res.data,
      invalidatesTags: ["Matches"],
    }),
    upsertMatchAttendance: builder.mutation<
      MatchAttendance[],
      { matchId: string; records: Record<string, unknown>[] }
    >({
      query: ({ matchId, records }) => ({
        url: `/coach/matches/${matchId}/attendance`,
        method: "POST",
        body: { records },
      }),
      transformResponse: (res: { data: MatchAttendance[] }) => res.data,
      invalidatesTags: ["Matches"],
    }),
    scanMatchAttendanceQr: builder.mutation<
      AttendanceQrScanResult,
      { matchId: string; payload: string }
    >({
      query: ({ matchId, payload }) => ({
        url: `/coach/matches/${matchId}/attendance/qr-scan`,
        method: "POST",
        body: { payload },
      }),
      transformResponse: (res: { data: AttendanceQrScanResult }) => res.data,
      invalidatesTags: ["Matches", "Notifications"],
    }),
    upsertMatchStats: builder.mutation<
      MatchPlayerStats[],
      { matchId: string; records: Record<string, unknown>[]; finalize?: boolean }
    >({
      query: ({ matchId, records, finalize }) => ({
        url: `/coach/matches/${matchId}/player-stats`,
        method: "POST",
        body: { records, finalize },
      }),
      transformResponse: (res: { data: MatchPlayerStats[] }) => res.data,
      invalidatesTags: ["Matches", "CalendarEvents"],
    }),
    createFriendlyRequest: builder.mutation<
      FriendlyMatchRequest,
      Record<string, unknown>
    >({
      query: (body) => ({
        url: "/coach/friendly-match-requests",
        method: "POST",
        body,
      }),
      transformResponse: (res: { data: FriendlyMatchRequest }) => res.data,
      invalidatesTags: ["FriendlyRequests"],
    }),
    getCoachFriendlyRequests: builder.query<
      PaginatedResponse<FriendlyMatchRequest>,
      void
    >({
      query: () => "/coach/friendly-match-requests?limit=100",
      transformResponse: (res: ApiListResponse<FriendlyMatchRequest>) =>
        toPaginated(res),
      providesTags: ["FriendlyRequests"],
    }),
    getCoachAdminMatchRequests: builder.query<
      PaginatedResponse<AdminCoachMatchRequest>,
      void
    >({
      query: () => "/coach/match-requests?limit=100",
      transformResponse: (res: ApiListResponse<AdminCoachMatchRequest>) =>
        toPaginated(res),
      providesTags: ["FriendlyRequests"],
    }),
    acceptCoachAdminMatchRequest: builder.mutation<
      Match,
      { id: string; groupId?: string; birthYearId?: string }
    >({
      query: ({ id, ...body }) => ({
        url: `/coach/match-requests/${id}/accept`,
        method: "POST",
        body,
      }),
      transformResponse: (res: { data: Match }) => res.data,
      invalidatesTags: ["FriendlyRequests", "Matches", "CalendarEvents"],
    }),
    getPlayerOptions: builder.query<
      PlayerOption[],
      { role?: "admin" | "coach"; fieldKey?: PlayerOption["field_key"] } | void
    >({
      query: (args) => {
        const role = args?.role ?? "admin";
        const params = args?.fieldKey ? `?fieldKey=${args.fieldKey}` : "";
        return `/${role}/player-field-options${params}`;
      },
      transformResponse: (res: { data: PlayerOption[] }) => res.data,
      providesTags: ["PlayerOptions"],
    }),
    createPlayerOption: builder.mutation<
      PlayerOption,
      { role: "admin" | "coach"; body: Record<string, unknown> }
    >({
      query: ({ role, body }) => ({
        url: `/${role}/player-field-options`,
        method: "POST",
        body,
      }),
      transformResponse: (res: { data: PlayerOption }) => res.data,
      invalidatesTags: ["PlayerOptions"],
    }),
    getCustomCategories: builder.query<
      CustomCategory[],
      { role: "admin" | "coach"; targetModule?: string } | void
    >({
      query: (args) => {
        const role = args?.role ?? "admin";
        const targetModule = args?.targetModule ?? "player_profile";
        return `/${role}/custom-categories?targetModule=${targetModule}`;
      },
      transformResponse: (res: { data: CustomCategory[] }) => res.data,
      providesTags: ["CustomData"],
    }),
    createCustomCategory: builder.mutation<
      CustomCategory,
      { role: "admin" | "coach"; body: Record<string, unknown> }
    >({
      query: ({ role, body }) => ({
        url: `/${role}/custom-categories`,
        method: "POST",
        body,
      }),
      transformResponse: (res: { data: CustomCategory }) => res.data,
      invalidatesTags: ["CustomData"],
    }),
    createCustomField: builder.mutation<
      CustomField,
      {
        role: "admin" | "coach";
        categoryId: string;
        body: Record<string, unknown>;
      }
    >({
      query: ({ role, categoryId, body }) => ({
        url: `/${role}/custom-categories/${categoryId}/fields`,
        method: "POST",
        body,
      }),
      transformResponse: (res: { data: CustomField }) => res.data,
      invalidatesTags: ["CustomData", "PlayerCustomProfile"],
    }),
    updateCustomField: builder.mutation<
      CustomField,
      { role: "admin" | "coach"; id: string; body: Record<string, unknown> }
    >({
      query: ({ role, id, body }) => ({
        url: `/${role}/custom-fields/${id}`,
        method: "PATCH",
        body,
      }),
      transformResponse: (res: { data: CustomField }) => res.data,
      invalidatesTags: ["CustomData", "PlayerCustomProfile"],
    }),
    deleteCustomField: builder.mutation<
      void,
      { role: "admin" | "coach"; id: string }
    >({
      query: ({ role, id }) => ({
        url: `/${role}/custom-fields/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["CustomData", "PlayerCustomProfile"],
    }),
    createCustomFieldOption: builder.mutation<
      CustomFieldOption,
      {
        role: "admin" | "coach";
        fieldId: string;
        body: Record<string, unknown>;
      }
    >({
      query: ({ role, fieldId, body }) => ({
        url: `/${role}/custom-fields/${fieldId}/options`,
        method: "POST",
        body,
      }),
      transformResponse: (res: { data: CustomFieldOption }) => res.data,
      invalidatesTags: ["CustomData", "PlayerCustomProfile"],
    }),
    updateCustomFieldOption: builder.mutation<
      CustomFieldOption,
      { role: "admin" | "coach"; id: string; body: Record<string, unknown> }
    >({
      query: ({ role, id, body }) => ({
        url: `/${role}/custom-field-options/${id}`,
        method: "PATCH",
        body,
      }),
      transformResponse: (res: { data: CustomFieldOption }) => res.data,
      invalidatesTags: ["CustomData", "PlayerCustomProfile"],
    }),
    deleteCustomFieldOption: builder.mutation<
      void,
      { role: "admin" | "coach"; id: string }
    >({
      query: ({ role, id }) => ({
        url: `/${role}/custom-field-options/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["CustomData", "PlayerCustomProfile"],
    }),
    updateCustomCategory: builder.mutation<
      CustomCategory,
      { role: "admin" | "coach"; id: string; body: Record<string, unknown> }
    >({
      query: ({ role, id, body }) => ({
        url: `/${role}/custom-categories/${id}`,
        method: "PATCH",
        body,
      }),
      transformResponse: (res: { data: CustomCategory }) => res.data,
      invalidatesTags: ["CustomData", "PlayerCustomProfile"],
    }),
    deleteCustomCategory: builder.mutation<
      void,
      { role: "admin" | "coach"; id: string }
    >({
      query: ({ role, id }) => ({
        url: `/${role}/custom-categories/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["CustomData", "PlayerCustomProfile"],
    }),
    getCoachPlayerCustomProfile: builder.query<PlayerCustomProfile, string>({
      query: (playerId) => `/coach/players/${playerId}/custom-profile`,
      transformResponse: (res: { data: PlayerCustomProfile }) => res.data,
      providesTags: ["PlayerCustomProfile"],
    }),
    saveCoachPlayerCustomProfile: builder.mutation<
      PlayerCustomProfile,
      {
        playerId: string;
        values: Array<{ fieldId: string; value: unknown }>;
        markProfileComplete?: boolean;
      }
    >({
      query: ({ playerId, values, markProfileComplete }) => ({
        url: `/coach/players/${playerId}/custom-profile`,
        method: "PATCH",
        body: { values, markProfileComplete },
      }),
      transformResponse: (res: { data: PlayerCustomProfile }) => res.data,
      invalidatesTags: ["PlayerCustomProfile", "CoachPlayers"],
    }),
    getPlayerProfile: builder.query<PlayerProfile, void>({
      query: () => "/player/profile",
      transformResponse: (res: { data: PlayerProfile }) => res.data,
      providesTags: ["CoachPlayers"],
    }),
    getPlayerAttendanceQr: builder.query<PlayerAttendanceQr, void>({
      query: () => "/player/attendance-qr",
      transformResponse: (res: { data: PlayerAttendanceQr }) => res.data,
      providesTags: ["CoachPlayers"],
    }),
    getPlayerProgress: builder.query<PlayerProgress, void>({
      query: () => "/player/progress",
      transformResponse: (res: { data: PlayerProgress }) => res.data,
      providesTags: ["CalendarEvents", "Matches"],
    }),
    getPlayerAttendance: builder.query<
      PaginatedResponse<PlayerAttendanceRecord>,
      { page?: number; limit?: number } | void
    >({
      query: (args) => {
        const params = new URLSearchParams({
          page: String(args?.page ?? 1),
          limit: String(args?.limit ?? 100),
        });
        return `/player/attendance?${params}`;
      },
      transformResponse: (res: ApiListResponse<PlayerAttendanceRecord>) =>
        toPaginated(res),
      providesTags: ["CalendarEvents"],
    }),
    getPlayerEvaluations: builder.query<
      PaginatedResponse<PlayerEvaluationRecord>,
      void
    >({
      query: () => "/player/evaluations?limit=100",
      transformResponse: (res: ApiListResponse<PlayerEvaluationRecord>) =>
        toPaginated(res),
      providesTags: ["CalendarEvents"],
    }),
    getPlayerFamilyNotes: builder.query<
      PaginatedResponse<ParentPlayerNote>,
      { page?: number; limit?: number; status?: ParentPlayerNote["status"] } | void
    >({
      query: (args) => {
        const params = new URLSearchParams({
          page: String(args?.page ?? 1),
          limit: String(args?.limit ?? 100),
        });
        if (args?.status) params.set("status", args.status);
        return `/player/parent-notes?${params}`;
      },
      transformResponse: (res: ApiListResponse<ParentPlayerNote>) =>
        toPaginated(res),
      providesTags: ["ParentPortal"],
    }),
    getPlayerTrainings: builder.query<
      PaginatedResponse<CalendarEvent>,
      void
    >({
      query: () => "/player/trainings?limit=100",
      transformResponse: (res: ApiListResponse<CalendarEvent>) =>
        toPaginated(res),
      providesTags: ["CalendarEvents"],
    }),
    getPlayerAssignments: builder.query<
      PaginatedResponse<PlayerAssignment>,
      { page?: number; limit?: number } | void
    >({
      query: (args) => {
        const params = new URLSearchParams({
          page: String(args?.page ?? 1),
          limit: String(args?.limit ?? 100),
        });
        return `/player/assignments?${params}`;
      },
      transformResponse: (res: ApiListResponse<PlayerAssignment>) =>
        toPaginated(res),
      providesTags: ["PlayerAssignments"],
    }),
    uploadPlayerAssignmentFile: builder.mutation<PlayerAssignmentUpload, File>({
      query: (file) => ({
        url: "/player/assignments/upload",
        method: "POST",
        body: file,
        headers: {
          "Content-Type": file.type || "application/octet-stream",
          "X-File-Name": encodeURIComponent(file.name || "assignment-file"),
        },
      }),
      transformResponse: (res: { data: PlayerAssignmentUpload }) => res.data,
    }),
    submitPlayerAssignment: builder.mutation<
      PlayerAssignmentSubmission,
      { assignmentId: string; notes?: string; files: PlayerAssignmentUpload[] }
    >({
      query: ({ assignmentId, ...body }) => ({
        url: `/player/assignments/${assignmentId}/submit`,
        method: "POST",
        body,
      }),
      transformResponse: (res: { data: PlayerAssignmentSubmission }) => res.data,
      invalidatesTags: ["PlayerAssignments"],
    }),
    submitDailyAiInput: builder.mutation<
      PlayerAssignmentSubmission,
      DailyAiSubmitInput
    >({
      query: (body) => ({
        url: "/player/assignments/daily-ai",
        method: "POST",
        body,
      }),
      transformResponse: (res: { data: PlayerAssignmentSubmission }) => res.data,
      invalidatesTags: ["PlayerAssignments"],
    }),
    getNotifications: builder.query<PaginatedResponse<NotificationRow>, void>({
      query: () => "/notifications?limit=20",
      transformResponse: (res: ApiListResponse<NotificationRow>) =>
        toPaginated(res),
      providesTags: ["Notifications"],
    }),
    getUnreadNotificationsCount: builder.query<number, void>({
      query: () => "/notifications/unread-count",
      transformResponse: (res: { data: { unread: number } }) =>
        res.data.unread,
      providesTags: ["Notifications"],
      keepUnusedDataFor: 60,
    }),
    markNotificationRead: builder.mutation<NotificationRow, string>({
      query: (id) => ({ url: `/notifications/${id}/read`, method: "PATCH" }),
      transformResponse: (res: { data: NotificationRow }) => res.data,
      invalidatesTags: ["Notifications"],
    }),
    markAllNotificationsRead: builder.mutation<
      { markedRead: number },
      void
    >({
      query: () => ({ url: "/notifications/read-all", method: "PATCH" }),
      transformResponse: (res: { data: { markedRead: number } }) => res.data,
      invalidatesTags: ["Notifications"],
    }),
    getPlayerMatches: builder.query<PaginatedResponse<Match>, void>({
      query: () => "/player/matches?limit=100",
      transformResponse: (res: ApiListResponse<Match>) => toPaginated(res),
      providesTags: ["Matches"],
    }),
    getPlayerCalendarEvents: builder.query<
      PaginatedResponse<CalendarEvent>,
      void
    >({
      query: () => "/player/calendar-events?limit=100",
      transformResponse: (res: ApiListResponse<CalendarEvent>) =>
        toPaginated(res),
      providesTags: ["CalendarEvents"],
    }),
    getAdminParentLinks: builder.query<
      PaginatedResponse<AdminParentLink>,
      { page?: number; limit?: number; search?: string; parentUserId?: string; playerId?: string } | void
    >({
      query: (args) => {
        const params = new URLSearchParams({
          page: String(args?.page ?? 1),
          limit: String(args?.limit ?? 100),
        });
        if (args?.search) params.set("search", args.search);
        if (args?.parentUserId) params.set("parentUserId", args.parentUserId);
        if (args?.playerId) params.set("playerId", args.playerId);
        return `/admin/parent-links?${params}`;
      },
      transformResponse: (res: ApiListResponse<AdminParentLink>) =>
        toPaginated(res),
      providesTags: ["ParentLinks"],
    }),
    getAdminParentAccounts: builder.query<
      PaginatedResponse<AdminParentAccount>,
      { page?: number; limit?: number; search?: string } | void
    >({
      query: (args) => {
        const params = new URLSearchParams({
          page: String(args?.page ?? 1),
          limit: String(args?.limit ?? 100),
        });
        if (args?.search) params.set("search", args.search);
        return `/admin/parent-accounts?${params}`;
      },
      transformResponse: (res: ApiListResponse<AdminParentAccount>) =>
        toPaginated(res),
      providesTags: ["ParentLinks"],
    }),
    getAdminLinkablePlayers: builder.query<
      PaginatedResponse<AdminLinkablePlayer>,
      { page?: number; limit?: number; search?: string } | void
    >({
      query: (args) => {
        const params = new URLSearchParams({
          page: String(args?.page ?? 1),
          limit: String(args?.limit ?? 100),
        });
        if (args?.search) params.set("search", args.search);
        return `/admin/parent-linkable-players?${params}`;
      },
      transformResponse: (res: ApiListResponse<AdminLinkablePlayer>) =>
        toPaginated(res),
      providesTags: ["ParentLinks"],
    }),
    createAdminParentLink: builder.mutation<
      AdminParentLink,
      {
        parentUserId: string;
        playerId: string;
        relation?: string;
        isPrimary?: boolean;
        canViewProgress?: boolean;
        canViewPayments?: boolean;
        canMessageCoach?: boolean;
      }
    >({
      query: (body) => ({ url: "/admin/parent-links", method: "POST", body }),
      transformResponse: (res: { data: AdminParentLink }) => res.data,
      invalidatesTags: ["ParentLinks", "ParentPortal"],
    }),
    updateAdminParentLink: builder.mutation<
      AdminParentLink,
      {
        parentLinkId: string;
        body: {
          relation?: string;
          isPrimary?: boolean;
          canViewProgress?: boolean;
          canViewPayments?: boolean;
          canMessageCoach?: boolean;
        };
      }
    >({
      query: ({ parentLinkId, body }) => ({
        url: `/admin/parent-links/${parentLinkId}`,
        method: "PATCH",
        body,
      }),
      transformResponse: (res: { data: AdminParentLink }) => res.data,
      invalidatesTags: ["ParentLinks", "ParentPortal"],
    }),
    deleteAdminParentLink: builder.mutation<
      { deleted: boolean; id: string },
      string
    >({
      query: (parentLinkId) => ({
        url: `/admin/parent-links/${parentLinkId}`,
        method: "DELETE",
      }),
      transformResponse: (res: { data: { deleted: boolean; id: string } }) => res.data,
      invalidatesTags: ["ParentLinks", "ParentPortal"],
    }),
    getManagedParentLinks: builder.query<
      PaginatedResponse<AdminParentLink>,
      ParentManagementQuery
    >({
      query: (args) => {
        const params = new URLSearchParams({
          page: String(args.page ?? 1),
          limit: String(args.limit ?? 100),
        });
        if (args.search) params.set("search", args.search);
        if (args.parentUserId) params.set("parentUserId", args.parentUserId);
        if (args.playerId) params.set("playerId", args.playerId);
        return `/${args.role}/parent-links?${params}`;
      },
      transformResponse: (res: ApiListResponse<AdminParentLink>) =>
        toPaginated(res),
      providesTags: ["ParentLinks"],
    }),
    getManagedParentAccounts: builder.query<
      PaginatedResponse<AdminParentAccount>,
      ParentManagementQuery
    >({
      query: (args) => {
        const params = new URLSearchParams({
          page: String(args.page ?? 1),
          limit: String(args.limit ?? 100),
        });
        if (args.search) params.set("search", args.search);
        return `/${args.role}/parent-accounts?${params}`;
      },
      transformResponse: (res: ApiListResponse<AdminParentAccount>) =>
        toPaginated(res),
      providesTags: ["ParentLinks"],
    }),
    getManagedParentProfile: builder.query<
      ManagedParentProfile,
      { role: ParentManagementRole; id: string }
    >({
      query: ({ role, id }) => `/${role}/parents/${id}/profile`,
      transformResponse: (res: { data: ManagedParentProfile }) => res.data,
      providesTags: ["ParentLinks", "ParentPortal", "CoachPlayers"],
    }),
    getManagedLinkablePlayers: builder.query<
      PaginatedResponse<AdminLinkablePlayer>,
      ParentManagementQuery
    >({
      query: (args) => {
        const params = new URLSearchParams({
          page: String(args.page ?? 1),
          limit: String(args.limit ?? 100),
        });
        if (args.search) params.set("search", args.search);
        return `/${args.role}/parent-linkable-players?${params}`;
      },
      transformResponse: (res: ApiListResponse<AdminLinkablePlayer>) =>
        toPaginated(res),
      providesTags: ["ParentLinks"],
    }),
    createManagedParentAccount: builder.mutation<
      AdminParentAccount,
      { role: ParentManagementRole; body: ParentAccountInput }
    >({
      query: ({ role, body }) => ({
        url: `/${role}/parents`,
        method: "POST",
        body,
      }),
      transformResponse: (res: { data: AdminParentAccount }) => res.data,
      invalidatesTags: ["ParentLinks"],
    }),
    createManagedParentLink: builder.mutation<
      AdminParentLink,
      { role: ParentManagementRole; body: ParentManualLinkInput }
    >({
      query: ({ role, body }) => ({
        url: `/${role}/parent-links`,
        method: "POST",
        body,
      }),
      transformResponse: (res: { data: AdminParentLink }) => res.data,
      invalidatesTags: ["ParentLinks", "ParentPortal"],
    }),
    linkManagedParentByQr: builder.mutation<
      AdminParentLink,
      { role: ParentManagementRole; body: ParentQrLinkInput }
    >({
      query: ({ role, body }) => ({
        url: `/${role}/parent-links/qr`,
        method: "POST",
        body,
      }),
      transformResponse: (res: { data: AdminParentLink }) => res.data,
      invalidatesTags: ["ParentLinks", "ParentPortal"],
    }),
    updateManagedParentLink: builder.mutation<
      AdminParentLink,
      {
        role: ParentManagementRole;
        parentLinkId: string;
        body: {
          relation?: string;
          isPrimary?: boolean;
          canViewProgress?: boolean;
          canViewPayments?: boolean;
          canMessageCoach?: boolean;
        };
      }
    >({
      query: ({ role, parentLinkId, body }) => ({
        url: `/${role}/parent-links/${parentLinkId}`,
        method: "PATCH",
        body,
      }),
      transformResponse: (res: { data: AdminParentLink }) => res.data,
      invalidatesTags: ["ParentLinks", "ParentPortal"],
    }),
    deleteManagedParentLink: builder.mutation<
      { deleted: boolean; id: string },
      { role: ParentManagementRole; parentLinkId: string }
    >({
      query: ({ role, parentLinkId }) => ({
        url: `/${role}/parent-links/${parentLinkId}`,
        method: "DELETE",
      }),
      transformResponse: (res: { data: { deleted: boolean; id: string } }) => res.data,
      invalidatesTags: ["ParentLinks", "ParentPortal"],
    }),
    getParentChildren: builder.query<ParentChild[], void>({
      query: () => "/parent/children",
      transformResponse: (res: { data: ParentChild[] }) => res.data,
      providesTags: ["ParentPortal"],
    }),
    getParentDashboard: builder.query<ParentDashboard, { childId?: string } | void>({
      query: (args) => {
        const params = new URLSearchParams();
        if (args?.childId) params.set("childId", args.childId);
        const query = params.toString();
        return `/parent/dashboard${query ? `?${query}` : ""}`;
      },
      transformResponse: (res: { data: ParentDashboard }) => res.data,
      providesTags: ["ParentPortal", "CalendarEvents", "Matches"],
    }),
    getParentChildProgress: builder.query<PlayerProgress, string>({
      query: (childId) => `/parent/children/${childId}/progress`,
      transformResponse: (res: { data: PlayerProgress }) => res.data,
      providesTags: ["ParentPortal", "CalendarEvents", "Matches"],
    }),
    getParentChildTrainings: builder.query<
      PaginatedResponse<CalendarEvent>,
      string
    >({
      query: (childId) => `/parent/children/${childId}/trainings?limit=100`,
      transformResponse: (res: ApiListResponse<CalendarEvent>) =>
        toPaginated(res),
      providesTags: ["CalendarEvents", "ParentPortal"],
    }),
    getParentChildAttendance: builder.query<
      PaginatedResponse<PlayerAttendanceRecord>,
      { childId: string; page?: number; limit?: number }
    >({
      query: ({ childId, page = 1, limit = 100 }) =>
        `/parent/children/${childId}/attendance?page=${page}&limit=${limit}`,
      transformResponse: (res: ApiListResponse<PlayerAttendanceRecord>) =>
        toPaginated(res),
      providesTags: ["CalendarEvents", "ParentPortal"],
    }),
    getParentChildEvaluations: builder.query<
      PaginatedResponse<PlayerEvaluationRecord>,
      { childId: string; page?: number; limit?: number }
    >({
      query: ({ childId, page = 1, limit = 100 }) =>
        `/parent/children/${childId}/evaluations?page=${page}&limit=${limit}`,
      transformResponse: (res: ApiListResponse<PlayerEvaluationRecord>) =>
        toPaginated(res),
      providesTags: ["CalendarEvents", "ParentPortal"],
    }),
    getParentChildMeasurements: builder.query<
      PaginatedResponse<ParentMeasurement>,
      { childId: string; page?: number; limit?: number }
    >({
      query: ({ childId, page = 1, limit = 100 }) =>
        `/parent/children/${childId}/measurements?page=${page}&limit=${limit}`,
      transformResponse: (res: ApiListResponse<ParentMeasurement>) =>
        toPaginated(res),
      providesTags: ["ParentPortal"],
    }),
    getParentChildPayments: builder.query<ParentPaymentSummary, string>({
      query: (childId) => `/parent/children/${childId}/payments`,
      transformResponse: (res: { data: ParentPaymentSummary }) => res.data,
      providesTags: ["ParentPortal"],
    }),
    getParentChildWeeklyReport: builder.query<ParentWeeklyReport, string>({
      query: (childId) => `/parent/children/${childId}/weekly-report`,
      transformResponse: (res: { data: ParentWeeklyReport }) => res.data,
      providesTags: ["ParentPortal", "CalendarEvents", "Matches"],
    }),
    getParentChildNotes: builder.query<
      PaginatedResponse<ParentPlayerNote>,
      { childId: string; page?: number; limit?: number; status?: string }
    >({
      query: ({ childId, page = 1, limit = 50, status }) => {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(limit),
        });
        if (status) params.set("status", status);
        return `/parent/children/${childId}/notes?${params}`;
      },
      transformResponse: (res: ApiListResponse<ParentPlayerNote>) =>
        toPaginated(res),
      providesTags: ["ParentPortal"],
    }),
    createParentChildNote: builder.mutation<
      ParentPlayerNote,
      {
        childId: string;
        body: {
          coachUserId?: string;
          category?: string;
          title?: string;
          body: string;
          visibility?: ParentPlayerNote["visibility"];
        };
      }
    >({
      query: ({ childId, body }) => ({
        url: `/parent/children/${childId}/notes`,
        method: "POST",
        body,
      }),
      transformResponse: (res: { data: ParentPlayerNote }) => res.data,
      invalidatesTags: ["ParentPortal"],
    }),
    getCoachParentNotes: builder.query<
      PaginatedResponse<ParentPlayerNote>,
      { page?: number; limit?: number; status?: string; playerId?: string } | void
    >({
      query: (args) => {
        const params = new URLSearchParams({
          page: String(args?.page ?? 1),
          limit: String(args?.limit ?? 100),
        });
        if (args?.status) params.set("status", args.status);
        if (args?.playerId) params.set("playerId", args.playerId);
        return `/coach/parent-notes?${params}`;
      },
      transformResponse: (res: ApiListResponse<ParentPlayerNote>) =>
        toPaginated(res),
      providesTags: ["ParentPortal"],
    }),
    respondCoachParentNote: builder.mutation<
      ParentPlayerNote,
      {
        noteId: string;
        body: {
          status?: ParentPlayerNote["status"];
          visibility?: ParentPlayerNote["visibility"];
          coachResponse?: string;
        };
      }
    >({
      query: ({ noteId, body }) => ({
        url: `/coach/parent-notes/${noteId}/respond`,
        method: "PATCH",
        body,
      }),
      transformResponse: (res: { data: ParentPlayerNote }) => res.data,
      invalidatesTags: ["ParentPortal"],
    }),
    getParentChildMatches: builder.query<PaginatedResponse<Match>, string>({
      query: (childId) => `/parent/children/${childId}/matches?limit=100`,
      transformResponse: (res: ApiListResponse<Match>) => toPaginated(res),
      providesTags: ["Matches", "ParentPortal"],
    }),
    getParentChildCalendarEvents: builder.query<
      PaginatedResponse<CalendarEvent>,
      string
    >({
      query: (childId) =>
        `/parent/children/${childId}/calendar-events?limit=100`,
      transformResponse: (res: ApiListResponse<CalendarEvent>) =>
        toPaginated(res),
      providesTags: ["CalendarEvents", "ParentPortal"],
    }),
  }),
});

export const {
  useGetAdminCalendarEventsQuery,
  useCreateAdminCalendarEventMutation,
  useHardDeleteAdminTrainingEventMutation,
  useGetAdminMatchesQuery,
  useGetAdminMatchQuery,
  useCreateAdminMatchMutation,
  useGetAdminCoachMatchRequestsQuery,
  useCreateAdminCoachMatchRequestMutation,
  useGetAdminEvaluationEditRequestsQuery,
  useApproveEvaluationEditRequestMutation,
  useRejectEvaluationEditRequestMutation,
  useUpdateAdminMatchMutation,
  useUpdateAdminMatchStatusMutation,
  usePostponeAdminMatchMutation,
  useDeleteAdminMatchMutation,
  useHardDeleteAdminMatchMutation,
  useGetAdminFriendlyRequestsQuery,
  useApproveFriendlyRequestMutation,
  useRejectFriendlyRequestMutation,
  useConvertFriendlyRequestMutation,
  useGetCoachCalendarEventsQuery,
  useGetCoachGroupsScopedQuery,
  useGetCoachPermissionsQuery,
  useGetCoachPlayersScopedQuery,
  useGetCoachPlayerDetailQuery,
  useGetManagedPlayerDetailQuery,
  useGetInjuryRiskPainDiscomfortQuery,
  useUpsertInjuryRiskPainDiscomfortMutation,
  useGetInjuryRiskPredictionsQuery,
  useRunInjuryRiskPredictionsMutation,
  useCreateCoachBasicPlayerMutation,
  useDownloadPlayerImportTemplateMutation,
  useValidatePlayerImportMutation,
  useImportPlayersMutation,
  useCompleteCoachPlayerProfileMutation,
  useCreateCoachTrainingEventMutation,
  useGetCoachTrainingEventQuery,
  useUpdateCoachTrainingStatusMutation,
  useExtendCoachTrainingEventMutation,
  useUpsertTrainingAttendanceMutation,
  useScanTrainingAttendanceQrMutation,
  useUpsertTrainingEvaluationsMutation,
  useGetCoachMatchesQuery,
  useGetCoachMatchQuery,
  useGetCoachRankingSystemInputsQuery,
  useGetPlayerRankingSystemInputsQuery,
  useGetParentRankingSystemInputsQuery,
  useRequestMatchEvaluationEditMutation,
  useUpsertMatchSquadMutation,
  useUpdateMatchSquadPlayerMutation,
  useDeleteMatchSquadPlayerMutation,
  useUpsertMatchTacticsMutation,
  useUpdateCoachMatchTargetsMutation,
  useUpdateMatchLiveStatusMutation,
  useRecordMatchIncidentMutation,
  useRecordMatchGoalMutation,
  useDeleteMatchGoalMutation,
  useRecordMatchSubstitutionMutation,
  useDeleteMatchSubstitutionMutation,
  useDeleteMatchIncidentMutation,
  useUpsertMatchAttendanceMutation,
  useScanMatchAttendanceQrMutation,
  useUpsertMatchStatsMutation,
  useCreateFriendlyRequestMutation,
  useGetCoachFriendlyRequestsQuery,
  useGetCoachAdminMatchRequestsQuery,
  useAcceptCoachAdminMatchRequestMutation,
  useGetPlayerOptionsQuery,
  useCreatePlayerOptionMutation,
  useGetCustomCategoriesQuery,
  useCreateCustomCategoryMutation,
  useCreateCustomFieldMutation,
  useUpdateCustomFieldMutation,
  useDeleteCustomFieldMutation,
  useCreateCustomFieldOptionMutation,
  useUpdateCustomFieldOptionMutation,
  useDeleteCustomFieldOptionMutation,
  useUpdateCustomCategoryMutation,
  useDeleteCustomCategoryMutation,
  useGetCoachPlayerCustomProfileQuery,
  useSaveCoachPlayerCustomProfileMutation,
  useGetPlayerProfileQuery,
  useGetPlayerAttendanceQrQuery,
  useGetPlayerProgressQuery,
  useGetPlayerAttendanceQuery,
  useGetPlayerEvaluationsQuery,
  useGetPlayerFamilyNotesQuery,
  useGetPlayerTrainingsQuery,
  useGetPlayerAssignmentsQuery,
  useUploadPlayerAssignmentFileMutation,
  useSubmitPlayerAssignmentMutation,
  useSubmitDailyAiInputMutation,
  useGetNotificationsQuery,
  useGetUnreadNotificationsCountQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
  useGetPlayerMatchesQuery,
  useGetPlayerCalendarEventsQuery,
  useGetAdminParentLinksQuery,
  useGetAdminParentAccountsQuery,
  useGetAdminLinkablePlayersQuery,
  useCreateAdminParentLinkMutation,
  useUpdateAdminParentLinkMutation,
  useDeleteAdminParentLinkMutation,
  useGetManagedParentLinksQuery,
  useGetManagedParentAccountsQuery,
  useGetManagedParentProfileQuery,
  useGetManagedLinkablePlayersQuery,
  useCreateManagedParentAccountMutation,
  useCreateManagedParentLinkMutation,
  useLinkManagedParentByQrMutation,
  useUpdateManagedParentLinkMutation,
  useDeleteManagedParentLinkMutation,
  useGetParentChildrenQuery,
  useGetParentDashboardQuery,
  useGetParentChildProgressQuery,
  useGetParentChildTrainingsQuery,
  useGetParentChildAttendanceQuery,
  useGetParentChildEvaluationsQuery,
  useGetParentChildMeasurementsQuery,
  useGetParentChildPaymentsQuery,
  useGetParentChildWeeklyReportQuery,
  useGetParentChildNotesQuery,
  useCreateParentChildNoteMutation,
  useGetCoachParentNotesQuery,
  useRespondCoachParentNoteMutation,
  useGetParentChildMatchesQuery,
  useGetParentChildCalendarEventsQuery,
} = calendarApi;
