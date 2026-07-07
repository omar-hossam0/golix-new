// ─── Enums & Constants ───────────────────────────────────────────

export type UserRole = "admin" | "coach" | "player" | "parent";

export type PlayerLevel = "A" | "B" | "C" | "D" | "F";

export type GoalStatus = "active" | "completed" | "paused";

export type PaymentStatus = "paid" | "pending" | "overdue" | "cancelled";

export type SubscriptionPlan = "monthly" | "quarterly" | "yearly";

export type AttendanceStatus = "present" | "absent" | "late" | "excused";

export type TrendDirection = "improving" | "stable" | "declining";

export type InjuryRisk = "low" | "medium" | "high";

export type PreferredFoot = "left" | "right" | "both";

// ─── Core Entities ───────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  username?: string;
  fullName: string;
  role: UserRole;
  avatarUrl?: string;
  phone?: string;
  linkedPlayerId?: string | null;
  totpEnabled?: boolean;
  createdAt: string;
}

export interface Academy {
  id: string;
  name: string;
  logoUrl?: string;
  address: string;
  phone: string;
  email: string;
  createdAt: string;
}

export interface Branch {
  id: string;
  academyId: string;
  name: string;
  address: string;
  capacity: number;
  currentPlayers: number;
  coachCount: number;
  groupCount: number;
  status: "active" | "inactive";
  createdAt: string;
}

export interface BirthYearRange {
  id: string;
  label?: string;
  fromYear: number;
  toYear: number;
}

export interface BirthYearGroup {
  label: string;
  normalizedLabel: string;
  birthYears: BirthYearRange[];
}

export interface BirthYear {
  id: string;
  branchId: string;
  label: string;
  fromYear: number;
  toYear: number;
  groupCount: number;
  playerCount: number;
}

export interface Group {
  id: string;
  branchId: string;
  birthYearIds?: string[];
  birthYears?: BirthYearRange[];
  name: string;
  coachId: string;
  coachName: string;
  playerCount: number;
  maxPlayers: number;
  schedule: string;
  status: "active" | "inactive";
}

export interface Coach {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  avatarUrl?: string;
  branchId: string;
  branchName: string;
  assignedGroups: string[];
  groupNames: string[];
  specialization: string;
  performanceScore: number;
  status: "active" | "inactive";
  joinDate: string;
}

export interface Player {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  avatarUrl?: string;
  branchId: string;
  branchName: string;
  groupId: string;
  groupName: string;
  parentId: string;
  parentName: string;
  level: PlayerLevel;
  position: string;
  preferredFoot: PreferredFoot;
  dateOfBirth: string;
  age: number;
  height: number;
  weight: number;
  attendanceRate: number;
  rankInGroup: number;
  performanceScore: number;
  trend: TrendDirection;
  injuryRisk: InjuryRisk;
  status: "active" | "inactive" | "injured";
  joinDate: string;
}

export interface Parent {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  avatarUrl?: string;
  childrenIds: string[];
  childrenNames: string[];
}

// ─── Operational Entities ────────────────────────────────────────

export interface Session {
  id: string;
  groupId: string;
  groupName: string;
  coachId: string;
  coachName: string;
  date: string;
  startTime: string;
  endTime: string;
  type: "training" | "match" | "assessment";
  notes?: string;
  attendanceCount?: number;
  totalPlayers?: number;
}

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  playerId: string;
  playerName: string;
  status: AttendanceStatus;
  notes?: string;
  markedBy: string;
  markedAt: string;
}

export interface Evaluation {
  id: string;
  playerId: string;
  playerName: string;
  coachId: string;
  coachName: string;
  date: string;
  technicalScore: number;
  tacticalScore: number;
  physicalScore: number;
  mentalScore: number;
  overallScore: number;
  notes: string;
}

export interface Measurement {
  id: string;
  playerId: string;
  playerName: string;
  date: string;
  height: number;
  weight: number;
  sprintSpeed?: number;
  endurance?: number;
  flexibility?: number;
  recordedBy: string;
}

export interface Ranking {
  id: string;
  playerId: string;
  playerName: string;
  groupId: string;
  groupName: string;
  rank: number;
  previousRank: number;
  score: number;
  trend: TrendDirection;
  period: "weekly" | "monthly";
  date: string;
}

// ─── Financial Entities ──────────────────────────────────────────

export interface Subscription {
  id: string;
  playerId: string;
  playerName: string;
  parentId: string;
  parentName: string;
  plan: SubscriptionPlan;
  amount: number;
  status: PaymentStatus;
  startDate: string;
  endDate: string;
  renewalDate: string;
}

export interface Invoice {
  id: string;
  subscriptionId: string;
  playerId: string;
  playerName: string;
  parentId: string;
  parentName: string;
  amount: number;
  status: PaymentStatus;
  issueDate: string;
  dueDate: string;
  paidDate?: string;
}

export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  method: "cash" | "card" | "bank_transfer";
  status: PaymentStatus;
  date: string;
}

// ─── Communication Entities ──────────────────────────────────────

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: "info" | "warning" | "alert" | "success";
  channel: "in_app" | "sms" | "whatsapp";
  targetRole?: UserRole;
  targetIds?: string[];
  read: boolean;
  sentAt: string;
  sentBy: string;
}

// ─── Dashboard & Analytics Types ─────────────────────────────────

export interface KPI {
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: string;
}

export interface ChartDataPoint {
  label: string;
  value: number;
}

export interface ActivityFeedItem {
  id: string;
  type: "attendance" | "evaluation" | "payment" | "player" | "notification";
  message: string;
  timestamp: string;
  userId?: string;
  userName?: string;
}

// ─── Report Types ────────────────────────────────────────────────

export interface PlayerProgressReport {
  playerId: string;
  playerName: string;
  period: string;
  attendanceRate: number;
  evaluationAvg: number;
  rankChange: number;
  measurementChanges: {
    height: number;
    weight: number;
  };
}

export interface AttendanceReport {
  branchId: string;
  branchName: string;
  totalSessions: number;
  averageAttendance: number;
  groupBreakdown: {
    groupName: string;
    rate: number;
  }[];
}

export interface CoachReport {
  coachId: string;
  coachName: string;
  playerImprovement: number;
  attendanceConsistency: number;
  evaluationFrequency: number;
  overallScore: number;
}
