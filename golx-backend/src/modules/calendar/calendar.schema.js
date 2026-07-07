const { z } = require("zod");
const {
  ASSIGNABLE_COACH_ACCESS_ROLE_VALUES,
} = require("../coaches/coach-assignment-roles");

const uuid = z.string().uuid();
const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date format: YYYY-MM-DD");
const timeSchema = z
  .string()
  .regex(
    /^(\d{2}:\d{2}(:\d{2})?|\d{1,2}:\d{2}\s*(AM|PM))$/i,
    "Time format: HH:mm or h:mm AM/PM",
  );
const dateTimeSchema = z
  .string()
  .datetime({ offset: true })
  .or(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/));

const eventTypeSchema = z.enum([
  "training",
  "match",
  "fitness_test",
  "meeting",
  "rest_day",
  "tournament",
  "medical_check",
  "assessment_day",
]);
const eventStatusSchema = z.enum([
  "scheduled",
  "completed",
  "finished",
  "cancelled",
  "postponed",
]);
const eventVisibilitySchema = z.enum([
  "all_assigned_groups",
  "selected_groups",
  "coaches_only",
]);
const matchTypeSchema = z.enum([
  "official",
  "friendly",
  "training",
  "training_match",
]);
const venueTypeSchema = z.enum(["home", "away", "neutral"]);
const matchCoreStatusSchema = z.enum([
  "scheduled",
  "postponed",
  "cancelled",
  "finished",
]);
const matchLiveStatusSchema = z.enum([
  "scheduled",
  "first_half",
  "second_half",
  "finished",
]);
const squadRoleSchema = z.enum(["starter", "substitute", "reserve"]);
const eventAttendanceStatusSchema = z.enum([
  "present",
  "absent",
  "late",
  "excused",
  "injured",
]);
const matchAttendanceStatusSchema = z.enum([
  "present",
  "absent",
  "late",
  "injured",
]);
const evaluationVisibilitySchema = z.enum([
  "private",
  "player_and_parent",
  "admin_only",
]);
const trainingFocusSchema = z.enum([
  "passing",
  "shooting",
  "dribbling",
  "ball_control",
  "crossing",
  "finishing",
  "attacking",
  "defense",
  "pressing",
  "transition",
  "possession",
  "speed",
  "agility",
  "strength",
  "endurance",
  "fitness",
  "recovery",
  "mentality",
  "vision",
  "decision_making",
  "goalkeeper",
  "set_pieces",
  "technical",
  "tactics",
  "physical",
]);
const intensitySchema = z.enum(["low", "medium", "high"]);
const opponentLevelSchema = z.enum(["weak", "medium", "strong"]);
const optionFieldSchema = z.enum(["position"]);

const idParam = z.object({ id: uuid });
const matchParam = z.object({ matchId: uuid });
const matchIncidentParam = z.object({ matchId: uuid, incidentId: uuid });
const matchGoalParam = z.object({ matchId: uuid, goalId: uuid });
const matchSubstitutionParam = z.object({
  matchId: uuid,
  substitutionId: uuid,
});
const eventParam = z.object({ eventId: uuid });
const eventPlayerParam = z.object({ eventId: uuid, playerId: uuid });
const childParam = z.object({ childId: uuid });
const childMatchParam = z.object({ childId: uuid, matchId: uuid });
const parentNoteParam = z.object({ noteId: uuid });
const parentLinkParam = z.object({ parentLinkId: uuid });
const playerMatchParam = z.object({ id: uuid });
const squadPlayerParam = z.object({ matchId: uuid, playerId: uuid });
const statsPlayerParam = z.object({ matchId: uuid, playerId: uuid });
const optionParam = z.object({ optionId: uuid });
const evaluationParam = z.object({ id: uuid });
const coachGroupAssignmentParam = z.object({ id: uuid });

const paginationQuery = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
});

const rankingSystemInputsQuery = paginationQuery.extend({
  limit: z.coerce.number().int().positive().max(2000).optional(),
  groupId: uuid.optional(),
});

const parentRankingSystemInputsQuery = rankingSystemInputsQuery.extend({
  childId: uuid.optional(),
});

const parentNoteStatusSchema = z.enum(["new", "reviewed", "resolved"]);
const parentNoteVisibilitySchema = z.enum([
  "coach_only",
  "parent_and_coach",
  "player_and_parent",
  "family",
]);
const parentDashboardQuery = z.object({
  childId: uuid.optional(),
});
const parentNotesQuery = paginationQuery.extend({
  status: parentNoteStatusSchema.optional(),
});
const coachParentNotesQuery = parentNotesQuery.extend({
  playerId: uuid.optional(),
});
const parentLinkQuery = paginationQuery.extend({
  search: z.string().trim().max(120).optional(),
  parentUserId: uuid.optional(),
  playerId: uuid.optional(),
});
const parentLinkSchema = z.object({
  parentUserId: uuid,
  playerId: uuid,
  relation: z.string().trim().min(2).max(60).optional(),
  isPrimary: z.boolean().optional(),
  canViewProgress: z.boolean().optional(),
  canViewPayments: z.boolean().optional(),
  canMessageCoach: z.boolean().optional(),
});
const updateParentLinkSchema = parentLinkSchema
  .pick({
    relation: true,
    isPrimary: true,
    canViewProgress: true,
    canViewPayments: true,
    canMessageCoach: true,
  })
  .partial();
const parentRelationshipSchema = z.enum([
  "father",
  "mother",
  "grandfather",
  "grandmother",
  "brother",
  "sister",
  "uncle",
  "aunt",
  "legal_guardian",
  "stepfather",
  "stepmother",
  "foster_parent",
  "guardian",
  "other",
]);
const parentUsernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(80)
  .regex(/^[a-zA-Z0-9._-]+$/, "Username may only contain letters, numbers, dots, underscores, and hyphens");
const parentPasswordSchema = z
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
  });
const parentAccountSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  username: parentUsernameSchema,
  password: parentPasswordSchema,
  phone: z.string().trim().min(8).max(20),
  address: z.string().trim().min(2).max(500),
  relationship: parentRelationshipSchema.default("guardian"),
});
const parentNoteSchema = z.object({
  coachUserId: uuid.optional(),
  category: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9_-]+$/i)
    .optional(),
  title: z.string().trim().max(160).optional(),
  body: z.string().trim().min(2).max(3000),
  visibility: parentNoteVisibilitySchema.optional(),
});
const coachParentNoteResponseSchema = z.object({
  status: parentNoteStatusSchema.optional(),
  visibility: parentNoteVisibilitySchema.optional(),
  coachResponse: z.string().trim().max(3000).optional(),
});

const evaluationEditRequestStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected",
]);

const evaluationEditRequestsQuery = paginationQuery.extend({
  status: evaluationEditRequestStatusSchema.optional(),
});

const evaluationEditRequestSchema = z.object({
  reason: z.string().max(2000).optional(),
});

const evaluationEditRequestReviewSchema = z.object({
  adminResponse: z.string().max(3000).optional(),
});

const coachPlayersQuery = paginationQuery.extend({
  customFieldId: uuid.optional(),
  customValue: z.string().max(255).optional(),
  customOptionId: uuid.optional(),
});

const calendarFiltersQuery = paginationQuery.extend({
  groupId: uuid.optional(),
  eventType: eventTypeSchema.optional(),
  status: eventStatusSchema.optional(),
  dateFrom: dateSchema.optional(),
  dateTo: dateSchema.optional(),
});

const adminMatchFiltersQuery = paginationQuery.extend({
  teamId: uuid.optional(),
  ageGroupId: uuid.optional(),
  groupId: uuid.optional(),
  matchType: matchTypeSchema.optional(),
  status: matchCoreStatusSchema.optional(),
  dateFrom: dateSchema.optional(),
  dateTo: dateSchema.optional(),
});

const adminCalendarEventBaseSchema = z.object({
  title: z.string().min(2).max(255),
  eventType: eventTypeSchema,
  startDatetime: dateTimeSchema,
  endDatetime: dateTimeSchema,
  location: z.string().max(255).optional(),
  status: eventStatusSchema.default("scheduled"),
  visibility: eventVisibilitySchema.default("selected_groups"),
  groupIds: z.array(uuid).min(1).max(50).optional(),
  notes: z.string().max(3000).optional(),
});

const adminCalendarEventSchema = adminCalendarEventBaseSchema.superRefine(
  (data, ctx) => {
    if (
      data.visibility !== "coaches_only" &&
      (!data.groupIds || data.groupIds.length === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["groupIds"],
        message: "At least one group is required.",
      });
    }
  },
);

const updateAdminCalendarEventSchema = adminCalendarEventBaseSchema.partial();

const adminMatchBaseSchema = z.object({
  teamId: uuid.optional(),
  ageGroupId: uuid.optional(),
  groupIds: z.array(uuid).max(50).optional(),
  birthYearIds: z.array(uuid).max(50).optional(),
  opponentName: z.string().min(2).max(255),
  matchType: matchTypeSchema,
  matchDate: dateSchema,
  matchTime: timeSchema,
  location: z.string().min(1).max(255),
  venueType: venueTypeSchema,
  refereeName: z.string().max(255).optional(),
  status: matchCoreStatusSchema.default("scheduled"),
  organizerNotes: z.string().max(3000).optional(),
  matchNotes: z.string().max(3000).optional(),
  ourScore: z.number().int().min(0).max(99).optional(),
  opponentScore: z.number().int().min(0).max(99).optional(),
});

const adminMatchSchema = adminMatchBaseSchema.extend({
  coachId: uuid,
});

const adminCoachMatchRequestSchema = adminMatchBaseSchema
  .omit({
    teamId: true,
    ageGroupId: true,
    groupIds: true,
    birthYearIds: true,
  })
  .extend({
    coachId: uuid,
  });

const coachResolveAdminMatchRequestSchema = z
  .object({
    groupId: uuid.optional(),
    birthYearId: uuid.optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.groupId && !data.birthYearId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["groupId"],
        message: "Select a group or birthday.",
      });
    }
    if (data.groupId && data.birthYearId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["groupId"],
        message: "Select either a group or a birthday, not both.",
      });
    }
  });

const updateAdminMatchSchema = adminMatchBaseSchema
  .partial()
  .superRefine((data, ctx) => {
    if ("opponentName" in data && !data.opponentName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["opponentName"],
        message: "Opponent name is required.",
      });
    }
  });

const adminPostponeMatchSchema = z.object({
  matchDate: dateSchema,
  matchTime: timeSchema,
  location: z.string().max(255).nullable().optional(),
  reason: z.string().max(3000).optional(),
});

const matchStatusSchema = z.object({
  status: matchCoreStatusSchema,
});

const coachTrainingEventBaseSchema = z.object({
  title: z.string().min(2).max(255),
  targetType: z.enum([
    "specific_group",
    "multiple_groups",
    "specific_groups",
    "all_my_assigned_groups",
  ]).optional(),
  groupIds: z.array(uuid).max(50).optional(),
  birthYearIds: z.array(uuid).max(50).optional(),
  playerIds: z.array(uuid).max(300).optional(),
  allGroups: z.boolean().optional(),
  allBirthYears: z.boolean().optional(),
  allPlayers: z.boolean().optional(),
  date: dateSchema,
  startTime: timeSchema,
  endTime: timeSchema,
  location: z.string().max(255).optional(),
  trainingFocus: trainingFocusSchema,
  intensityLevel: intensitySchema.default("medium"),
  objectives: z.string().max(3000).optional(),
  sessionPlan: z.string().max(5000).optional(),
  equipmentNeeded: z.string().max(2000).optional(),
  notes: z.string().max(3000).optional(),
});

const coachTrainingEventSchema = coachTrainingEventBaseSchema.superRefine(
  (data, ctx) => {
    const hasGroups =
      data.allGroups ||
      data.targetType === "all_my_assigned_groups" ||
      Boolean(data.groupIds?.length);
    const hasBirthYears = data.allBirthYears || Boolean(data.birthYearIds?.length);
    const hasPlayers = data.allPlayers || Boolean(data.playerIds?.length);
    if (!hasGroups && !hasBirthYears && !hasPlayers) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["groupIds"],
        message: "Select at least one group, birthday, or player.",
      });
    }
  },
);

const updateCoachTrainingEventSchema = coachTrainingEventBaseSchema.partial();

const trainingStatusSchema = z.object({
  status: eventStatusSchema,
});

const trainingExtendSchema = z.object({
  minutes: z.number().int().min(1).max(60),
});

const attendanceRecordsSchema = z.object({
  records: z
    .array(
      z.object({
        playerId: uuid,
        status: eventAttendanceStatusSchema,
        arrivalTime: timeSchema.optional(),
        reason: z.string().max(500).optional(),
        notes: z.string().max(500).optional(),
      }),
    )
    .min(1)
    .max(200),
});

const attendanceQrScanSchema = z
  .object({
    payload: z.string().trim().min(1).max(2000).optional(),
    playerId: uuid.optional(),
    playerCode: z.string().trim().min(1).max(100).optional(),
    username: z.string().trim().min(1).max(100).optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.payload && !data.playerId && !data.playerCode && !data.username) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["payload"],
        message: "QR payload, player ID, player code, or username is required.",
      });
    }
  });
const parentLinkQrSchema = z
  .object({
    parentUserId: uuid,
    relation: z.string().trim().min(2).max(60).optional(),
    isPrimary: z.boolean().optional(),
    canViewProgress: z.boolean().optional(),
    canViewPayments: z.boolean().optional(),
    canMessageCoach: z.boolean().optional(),
    payload: z.string().trim().min(1).max(2000).optional(),
    playerId: uuid.optional(),
    playerCode: z.string().trim().min(1).max(100).optional(),
    username: z.string().trim().min(1).max(100).optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.payload && !data.playerId && !data.playerCode && !data.username) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["payload"],
        message: "QR payload, player ID, player code, or username is required.",
      });
    }
  });

const updateEventAttendanceSchema = z.object({
  status: eventAttendanceStatusSchema.optional(),
  arrivalTime: timeSchema.optional(),
  reason: z.string().max(500).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

const injuryRiskPainDiscomfortSchema = z.object({
  records: z
    .array(
      z.object({
        playerId: uuid,
        painOrDiscomfort: z.coerce.number().int().min(0).max(1),
      }),
    )
    .min(1)
    .max(500),
});

const evaluationRecordsSchema = z.object({
  records: z
    .array(
      z.object({
        playerId: uuid,
        overallRating: z.number().min(0).max(10).optional(),
        technicalRating: z.number().min(0).max(10).optional(),
        tacticalRating: z.number().min(0).max(10).optional(),
        physicalRating: z.number().min(0).max(10).optional(),
        fatigueRating: z.number().min(0).max(10).optional(),
        mentalityRating: z.number().min(0).max(10).optional(),
        disciplineRating: z.number().min(0).max(10).optional(),
        teamworkRating: z.number().min(0).max(10).optional(),
        impactRating: z.number().min(0).max(10).optional(),
        ballControlRating: z.number().min(0).max(10).optional(),
        passingAccuracyRating: z.number().min(0).max(10).optional(),
        shootingRating: z.number().min(0).max(10).optional(),
        dribblingRating: z.number().min(0).max(10).optional(),
        receivingUnderPressureRating: z.number().min(0).max(10).optional(),
        speedRating: z.number().min(0).max(10).optional(),
        enduranceRating: z.number().min(0).max(10).optional(),
        strengthRating: z.number().min(0).max(10).optional(),
        agilityRating: z.number().min(0).max(10).optional(),
        strengths: z.string().max(2000).optional(),
        weaknesses: z.string().max(2000).optional(),
        coachNotes: z.string().max(3000).optional(),
        improvementPlan: z.string().max(3000).optional(),
        developmentNotes: z.string().max(3000).optional(),
        visibility: evaluationVisibilitySchema.default("private"),
      }),
    )
    .min(1)
    .max(200),
});

const updateEvaluationSchema = z.object({
  overallRating: z.number().min(0).max(10).optional(),
  technicalRating: z.number().min(0).max(10).optional(),
  tacticalRating: z.number().min(0).max(10).optional(),
  physicalRating: z.number().min(0).max(10).optional(),
  fatigueRating: z.number().min(0).max(10).optional(),
  mentalityRating: z.number().min(0).max(10).optional(),
  disciplineRating: z.number().min(0).max(10).optional(),
  teamworkRating: z.number().min(0).max(10).optional(),
  impactRating: z.number().min(0).max(10).optional(),
  ballControlRating: z.number().min(0).max(10).optional(),
  passingAccuracyRating: z.number().min(0).max(10).optional(),
  shootingRating: z.number().min(0).max(10).optional(),
  dribblingRating: z.number().min(0).max(10).optional(),
  receivingUnderPressureRating: z.number().min(0).max(10).optional(),
  speedRating: z.number().min(0).max(10).optional(),
  enduranceRating: z.number().min(0).max(10).optional(),
  strengthRating: z.number().min(0).max(10).optional(),
  agilityRating: z.number().min(0).max(10).optional(),
  strengths: z.string().max(2000).nullable().optional(),
  weaknesses: z.string().max(2000).nullable().optional(),
  coachNotes: z.string().max(3000).nullable().optional(),
  improvementPlan: z.string().max(3000).nullable().optional(),
  developmentNotes: z.string().max(3000).nullable().optional(),
  visibility: evaluationVisibilitySchema.optional(),
});

const squadEntrySchema = z.object({
  playerId: uuid,
  squadRole: squadRoleSchema,
  position: z.string().max(50).optional(),
  shirtNumber: z.number().int().min(1).max(99).optional(),
  playerInstruction: z.string().max(1000).optional(),
});

const squadSchema = z.union([
  squadEntrySchema,
  z.object({ players: z.array(squadEntrySchema).min(1).max(40) }),
]);

const updateSquadSchema = z.object({
  squadRole: squadRoleSchema.optional(),
  position: z.string().max(50).nullable().optional(),
  shirtNumber: z.number().int().min(1).max(99).nullable().optional(),
  playerInstruction: z.string().max(1000).nullable().optional(),
});

const tacticsSchema = z.object({
  formation: z.string().min(3).max(20),
  tacticalNotes: z.string().max(5000).optional(),
});

const matchTargetSchema = z
  .object({
    groupId: uuid.optional(),
    birthYearId: uuid.optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.groupId && !data.birthYearId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["groupId"],
        message: "Select a group or birthday.",
      });
    }
    if (data.groupId && data.birthYearId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["groupId"],
        message: "Select either a group or a birthday, not both.",
      });
    }
  });

const matchLiveStatusUpdateSchema = z.object({
  matchStatus: matchLiveStatusSchema,
  firstHalfStoppageMinutes: z.number().int().min(0).max(30).optional(),
  secondHalfStoppageMinutes: z.number().int().min(0).max(30).optional(),
});

const matchIncidentSchema = z
  .object({
    playerId: uuid,
    incidentType: z.enum(["yellow_card", "red_card", "injury"]),
    minute: z.number().int().min(0).max(130).optional(),
    bodyPart: z.string().min(1).max(100).optional(),
    notes: z.string().max(1000).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.incidentType === "injury" && !data.bodyPart) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["bodyPart"],
        message: "Body part is required for injuries.",
      });
    }
  });

const matchGoalSchema = z
  .object({
    team: z.enum(["our", "opponent"]).default("our"),
    scorerPlayerId: uuid.optional(),
    assistPlayerId: uuid.optional(),
    minute: z.number().int().min(0).max(130).optional(),
    notes: z.string().max(1000).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.team === "our" && !data.scorerPlayerId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["scorerPlayerId"],
        message: "Scorer is required for our goals.",
      });
    }
    if (
      data.scorerPlayerId &&
      data.assistPlayerId &&
      data.scorerPlayerId === data.assistPlayerId
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["assistPlayerId"],
        message: "Assist player must be different from scorer.",
      });
    }
  });

const matchSubstitutionSchema = z
  .object({
    outPlayerId: uuid,
    inPlayerId: uuid,
    minute: z.number().int().min(0).max(130).optional(),
    reason: z.string().max(1000).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.outPlayerId === data.inPlayerId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["inPlayerId"],
        message: "Substitution players must be different.",
      });
    }
  });

const matchAttendanceRecordsSchema = z.object({
  records: z
    .array(
      z.object({
        playerId: uuid,
        status: matchAttendanceStatusSchema,
        notes: z.string().max(500).optional(),
      }),
    )
    .min(1)
    .max(40),
});

const statEntrySchema = z.object({
  playerId: uuid,
  minutesPlayed: z.number().int().min(0).max(130).default(0),
  goals: z.number().int().min(0).max(30).default(0),
  assists: z.number().int().min(0).max(30).default(0),
  passesCompleted: z.number().int().min(0).max(500).default(0),
  passAccuracyPercentage: z.number().min(0).max(100).optional(),
  shotsTotal: z.number().int().min(0).max(100).default(0),
  shotsOnTarget: z.number().int().min(0).max(100).default(0),
  keyPasses: z.number().int().min(0).max(100).default(0),
  tackles: z.number().int().min(0).max(100).default(0),
  defensiveTackles: z.number().int().min(0).max(100).default(0),
  interceptions: z.number().int().min(0).max(100).default(0),
  duelsWon: z.number().int().min(0).max(100).default(0),
  duelsLost: z.number().int().min(0).max(100).default(0),
  possessionLosses: z.number().int().min(0).max(100).default(0),
  saves: z.number().int().min(0).max(100).default(0),
  yellowCards: z.number().int().min(0).max(2).default(0),
  redCards: z.number().int().min(0).max(1).default(0),
  fouls: z.number().int().min(0).max(100).default(0),
  injuries: z.string().max(1000).optional(),
  performanceRating: z.number().min(0).max(10).optional(),
  technicalRating: z.number().min(0).max(10).optional(),
  tacticalRating: z.number().min(0).max(10).optional(),
  physicalRating: z.number().min(0).max(10).optional(),
  fatigueRating: z.number().min(0).max(10).optional(),
  mentalityRating: z.number().min(0).max(10).optional(),
  decisionMakingRating: z.number().min(0).max(10).optional(),
  workRateRating: z.number().min(0).max(10).optional(),
  positioningRating: z.number().min(0).max(10).optional(),
  strengths: z.string().max(2000).optional(),
  weaknesses: z.string().max(2000).optional(),
  improvementPlan: z.string().max(3000).optional(),
  coachNotes: z.string().max(3000).optional(),
});

const playerStatsSchema = z.union([
  statEntrySchema,
  z.object({
    records: z.array(statEntrySchema).min(1).max(40),
    finalize: z.boolean().optional(),
  }),
]);

const updatePlayerStatsSchema = statEntrySchema
  .omit({ playerId: true })
  .partial();

const friendlyRequestSchema = z.object({
  teamId: uuid.optional(),
  ageGroupId: uuid.optional(),
  birthYearId: uuid.optional(),
  preferredDate: dateSchema,
  preferredTime: timeSchema,
  opponentLevel: opponentLevelSchema,
  suggestedOpponentName: z.string().max(255).optional(),
  reason: z.string().min(2).max(3000),
  notes: z.string().max(3000).optional(),
});

const rejectFriendlyRequestSchema = z.object({
  adminResponse: z.string().min(2).max(3000),
});

const approveFriendlyRequestSchema = z.object({
  adminResponse: z.string().max(3000).optional(),
});

const convertFriendlyRequestSchema = adminMatchBaseSchema
  .pick({
    location: true,
    venueType: true,
    refereeName: true,
    organizerNotes: true,
  })
  .partial();

const optionSchema = z.object({
  fieldKey: optionFieldSchema,
  label: z.string().min(1).max(120),
  value: z.string().min(1).max(120).optional(),
  isActive: z.boolean().optional(),
});

const updateOptionSchema = optionSchema.partial();

const optionQuery = z.object({
  fieldKey: optionFieldSchema.optional(),
});

const coachGroupAssignmentSchema = z.object({
  coachId: uuid,
  groupId: uuid,
  role: z.enum(ASSIGNABLE_COACH_ACCESS_ROLE_VALUES).default("assistant_coach"),
});

const updateCoachGroupAssignmentSchema = coachGroupAssignmentSchema
  .omit({ coachId: true, groupId: true })
  .partial();

const coachBasicPlayerSchema = z
  .object({
    username: z.string().trim().min(3).max(80).optional(),
    password: z.string().min(8).max(128).optional(),
    phone: z.string().min(8).max(20).optional(),
    fullName: z.string().min(2).max(100),
    birthDate: dateSchema,
    dateJoined: dateSchema.optional(),
    groupId: uuid.optional(),
    branchId: uuid.optional(),
    position: z.string().max(30).optional(),
    level: z.string().max(30).optional(),
    gender: z.enum(["male", "female", "other"]).optional(),
    nationality: z.string().max(100).optional(),
    address: z.string().max(500).optional(),
    heightCm: z.number().positive().optional(),
    weightKg: z.number().positive().optional(),
    preferredFoot: z.enum(["left", "right", "both"]).optional(),
    guardianName: z.string().max(100).optional(),
    guardianPhone: z.string().max(20).optional(),
    guardianRelation: z.string().max(50).optional(),
    notes: z.string().max(1000).optional(),
  })
  .refine(
    (data) =>
      (!data.username && !data.password) || (data.username && data.password),
    {
      message: "Username and password must be provided together",
      path: ["username"],
    },
  );

const coachCompletePlayerProfileSchema = z.record(z.any());

const playerAssignmentParam = z.object({
  id: uuid,
});

const playerAssignmentFileSchema = z.object({
  fileType: z.enum(["pdf", "word", "image"]),
  fileName: z.string().min(1).max(255),
  fileUrl: z.string().min(1).max(2000),
  mimeType: z.string().max(120).optional(),
  sizeBytes: z.number().int().positive().max(25 * 1024 * 1024).optional(),
});

const playerAssignmentSubmitSchema = z.object({
  notes: z.string().max(2000).optional(),
  files: z.array(playerAssignmentFileSchema).min(1).max(8),
});

const dailyAiInputSchema = z.object({
  sleepHours: z.number().int().min(0).max(12),
  trainedToday: z.union([z.literal(0), z.literal(1)]),
  mealsCount: z.number().int().min(0).max(8),
});

module.exports = {
  idParam,
  matchParam,
  matchIncidentParam,
  matchGoalParam,
  matchSubstitutionParam,
  eventParam,
  eventPlayerParam,
  childParam,
  childMatchParam,
  parentNoteParam,
  parentLinkParam,
  playerMatchParam,
  squadPlayerParam,
  statsPlayerParam,
  optionParam,
  evaluationParam,
  coachGroupAssignmentParam,
  paginationQuery,
  rankingSystemInputsQuery,
  parentRankingSystemInputsQuery,
  evaluationEditRequestsQuery,
  evaluationEditRequestSchema,
  evaluationEditRequestReviewSchema,
  coachPlayersQuery,
  calendarFiltersQuery,
  adminMatchFiltersQuery,
  parentDashboardQuery,
  parentNotesQuery,
  coachParentNotesQuery,
  parentLinkQuery,
  parentLinkSchema,
  updateParentLinkSchema,
  parentAccountSchema,
  parentLinkQrSchema,
  parentNoteSchema,
  coachParentNoteResponseSchema,
  adminCalendarEventSchema,
  updateAdminCalendarEventSchema,
  adminMatchSchema,
  adminCoachMatchRequestSchema,
  coachResolveAdminMatchRequestSchema,
  updateAdminMatchSchema,
  adminPostponeMatchSchema,
  matchStatusSchema,
  coachTrainingEventSchema,
  updateCoachTrainingEventSchema,
  trainingStatusSchema,
  trainingExtendSchema,
  attendanceRecordsSchema,
  attendanceQrScanSchema,
  updateEventAttendanceSchema,
  injuryRiskPainDiscomfortSchema,
  evaluationRecordsSchema,
  updateEvaluationSchema,
  squadSchema,
  updateSquadSchema,
  tacticsSchema,
  matchTargetSchema,
  matchLiveStatusUpdateSchema,
  matchIncidentSchema,
  matchGoalSchema,
  matchSubstitutionSchema,
  matchAttendanceRecordsSchema,
  playerStatsSchema,
  updatePlayerStatsSchema,
  friendlyRequestSchema,
  rejectFriendlyRequestSchema,
  approveFriendlyRequestSchema,
  convertFriendlyRequestSchema,
  optionSchema,
  updateOptionSchema,
  optionQuery,
  coachGroupAssignmentSchema,
  updateCoachGroupAssignmentSchema,
  coachBasicPlayerSchema,
  coachCompletePlayerProfileSchema,
  playerAssignmentParam,
  playerAssignmentSubmitSchema,
  dailyAiInputSchema,
};
