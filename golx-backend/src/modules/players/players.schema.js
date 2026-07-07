const { z } = require("zod");

const uuidParam = z.object({ id: z.string().uuid() });

const playerCredentialsProvidedTogether = (data) =>
  (!data.username && !data.password) || (data.username && data.password);
const scoreSchema = z.number().int().min(1).max(100).optional();
const percentSchema = z.number().min(0).max(100).optional();
const nonNegativeIntSchema = z.number().int().min(0).optional();
const positiveNumberSchema = z.number().positive().optional();
const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date format: YYYY-MM-DD");
const playerLevelSchema = z.enum(["A", "B", "C", "D", "F"]);

const playerBaseSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(80)
    .regex(
      /^[a-zA-Z0-9._-]+$/,
      "Username may only contain letters, numbers, dots, underscores, and hyphens",
    )
    .optional(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128)
    .refine((p) => /[A-Z]/.test(p), {
      message: "Password must contain at least one uppercase letter",
    })
    .refine((p) => /[0-9]/.test(p), {
      message: "Password must contain at least one digit",
    })
    .refine((p) => /[^A-Za-z0-9]/.test(p), {
      message: "Password must contain at least one special character",
    })
    .optional(),
  phone: z.string().min(8).max(20).optional(),
  fullName: z.string().min(2).max(100),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date format: YYYY-MM-DD"),
  dateJoined: dateSchema.optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  address: z.string().max(500).optional(),
  nationality: z.string().max(100).optional(),
  branchId: z.string().uuid(),
  groupId: z.string().uuid().optional(),
  level: playerLevelSchema.optional(),
  position: z.string().max(30).optional(),
  preferredFoot: z.enum(["left", "right", "both"]).optional(),
  notes: z.string().max(1000).optional(),
  guardianName: z.string().max(100).optional(),
  guardianPhone: z.string().max(20).optional(),
  guardianRelation: z.string().max(50).optional(),
  heightCm: z.number().positive().max(250).optional(),
  weightKg: z.number().positive().max(200).optional(),
  bmi: z.number().positive().max(80).optional(),
  sprintSpeed: positiveNumberSchema,
  stamina: scoreSchema,
  flexibility: scoreSchema,
  ballControl: scoreSchema,
  firstTouch: scoreSchema,
  passing: scoreSchema,
  shooting: scoreSchema,
  dribbling: scoreSchema,
  crossing: scoreSchema,
  heading: scoreSchema,
  tackling: scoreSchema,
  weakFoot: scoreSchema,
  finishing: scoreSchema,
  longPassing: scoreSchema,
  shortPassing: scoreSchema,
  positioning: scoreSchema,
  decisionMaking: scoreSchema,
  offBallMovement: scoreSchema,
  pressing: scoreSchema,
  defensiveAwareness: scoreSchema,
  teamwork: scoreSchema,
  gameReading: scoreSchema,
  trackingBack: scoreSchema,
  creatingSpace: scoreSchema,
  tacticalDiscipline: scoreSchema,
  trainingSessionsCount: nonNegativeIntSchema,
  attendanceCount: nonNegativeIntSchema,
  absenceCount: nonNegativeIntSchema,
  lateArrivals: nonNegativeIntSchema,
  attendanceRate: percentSchema,
  trainingPerformanceRating: scoreSchema,
  coachNotes: z.string().max(2000).optional(),
  improvementNotes: z.string().max(2000).optional(),
  matchesPlayed: nonNegativeIntSchema,
  minutesPlayed: nonNegativeIntSchema,
  goals: nonNegativeIntSchema,
  assists: nonNegativeIntSchema,
  shots: nonNegativeIntSchema,
  shotsOnTarget: nonNegativeIntSchema,
  passAccuracy: percentSchema,
  keyPasses: nonNegativeIntSchema,
  successfulDribbles: nonNegativeIntSchema,
  tackles: nonNegativeIntSchema,
  interceptions: nonNegativeIntSchema,
  fouls: nonNegativeIntSchema,
  yellowCards: nonNegativeIntSchema,
  redCards: nonNegativeIntSchema,
  manOfTheMatchCount: nonNegativeIntSchema,
  matchRating: z.number().min(0).max(10).optional(),
  medicalNotes: z.string().max(2000).optional(),
  injuryHistory: z.string().max(2000).optional(),
  currentInjuryStatus: z
    .enum(["none", "injured", "rehab", "recovered"])
    .optional(),
  injuryType: z.string().max(100).optional(),
  injuryDate: dateSchema.optional(),
  recoveryDate: dateSchema.optional(),
  fitnessStatus: z.enum(["fit", "limited", "unfit", "medical_hold"]).optional(),
  allergies: z.string().max(1000).optional(),
  chronicProblems: z.string().max(1000).optional(),
  overallRating: z.number().min(0).max(100).optional(),
  potentialRating: z.number().min(0).max(100).optional(),
  strengths: z.string().max(2000).optional(),
  weaknesses: z.string().max(2000).optional(),
  recommendedPosition: z.string().max(50).optional(),
  developmentPlan: z.string().max(2000).optional(),
  coachFinalNotes: z.string().max(2000).optional(),
  subscriptionType: z.enum(["monthly", "quarterly", "yearly"]).optional(),
  monthlyFees: z.number().min(0).max(1000000).optional(),
  paymentStatus: z.enum(["pending", "paid", "overdue", "cancelled"]).optional(),
  lastPaymentDate: dateSchema.optional(),
  nextPaymentDue: dateSchema.optional(),
  discount: z.number().min(0).max(1000000).optional(),
  penalty: z.number().min(0).max(1000000).optional(),
  userId: z.string().uuid().optional(),
  isActive: z.boolean().optional(),
  markProfileComplete: z.boolean().optional(),
});

const createPlayerSchema = playerBaseSchema.refine(
  playerCredentialsProvidedTogether,
  {
    message: "Username and password must be provided together",
    path: ["username"],
  },
);

const updatePlayerSchema = playerBaseSchema
  .partial()
  .refine((data) => !data.username, {
    message: "Username cannot be changed",
    path: ["username"],
  });

const listPlayersQuery = z.object({
  branchId: z.string().uuid().optional(),
  groupId: z.string().uuid().optional(),
  level: playerLevelSchema.optional(),
  isActive: z.coerce.boolean().optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

const addMeasurementSchema = z.object({
  heightCm: z.number().positive().max(250).optional(),
  weightKg: z.number().positive().max(200).optional(),
  bmi: z.number().positive().max(80).optional(),
  sprintSpeed: positiveNumberSchema,
  stamina: scoreSchema,
  flexibility: scoreSchema,
  recordedMonth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date format: YYYY-MM-DD"),
  notes: z.string().max(500).optional(),
});

const addInjurySchema = z.object({
  injuryType: z.string().min(2).max(100),
  bodyPart: z.string().max(50).optional(),
  severity: z.enum(["minor", "moderate", "severe"]),
  occurredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  recoveredAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  notes: z.string().max(1000).optional(),
});

const assignGroupSchema = z.object({
  groupId: z.string().uuid(),
});

module.exports = {
  uuidParam,
  createPlayerSchema,
  updatePlayerSchema,
  listPlayersQuery,
  addMeasurementSchema,
  addInjurySchema,
  assignGroupSchema,
};
