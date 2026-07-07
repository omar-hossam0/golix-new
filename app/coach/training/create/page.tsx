"use client";

import { useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Check, Loader2, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useGetCoachBirthdaysQuery } from "@/lib/store/api/coachApi";
import {
  useCreateCoachTrainingEventMutation,
  useGetCoachGroupsScopedQuery,
  useGetCoachPlayersScopedQuery,
} from "@/lib/store/api/calendarApi";
import { useDashboardLanguage } from "@/lib/hooks/useDashboardLanguage";

const focusGroups = [
  {
    labelKey: "technical",
    options: [
      ["passing", "passing"],
      ["shooting", "shooting"],
      ["dribbling", "dribbling"],
      ["ball_control", "ballControl"],
      ["crossing", "crossing"],
      ["finishing", "finishing"],
    ],
  },
  {
    labelKey: "tactical",
    options: [
      ["attacking", "attacking"],
      ["defense", "defense"],
      ["pressing", "pressing"],
      ["transition", "transition"],
      ["possession", "possession"],
    ],
  },
  {
    labelKey: "physical",
    options: [
      ["speed", "speed"],
      ["agility", "agility"],
      ["strength", "strength"],
      ["endurance", "endurance"],
      ["fitness", "fitness"],
      ["recovery", "recovery"],
    ],
  },
  {
    labelKey: "mental",
    options: [
      ["mentality", "mentality"],
      ["vision", "vision"],
      ["decision_making", "decisionMaking"],
    ],
  },
  {
    labelKey: "special",
    options: [
      ["goalkeeper", "goalkeeper"],
      ["set_pieces", "setPieces"],
    ],
  },
] as const;

const trainingCreateCopy = {
  en: {
    createError: "Could not create training. Check the selected targets.",
    created: "{title} created",
    pageTitle: "Create Training Event",
    pageDescription: "Schedule training for selected groups, birth years, and players.",
    home: "Home",
    createTrainingBreadcrumb: "Create Training",
    title: "Title",
    trainingFocus: "Training Focus",
    focusGroups: {
      technical: "Technical",
      tactical: "Tactical",
      physical: "Physical",
      mental: "Mental",
      special: "Special",
    },
    focusOptions: {
      passing: "Passing",
      shooting: "Shooting",
      dribbling: "Dribbling",
      ballControl: "Ball Control",
      crossing: "Crossing",
      finishing: "Finishing",
      attacking: "Attacking",
      defense: "Defense",
      pressing: "Pressing",
      transition: "Transition",
      possession: "Possession",
      speed: "Speed",
      agility: "Agility",
      strength: "Strength",
      endurance: "Endurance",
      fitness: "Fitness",
      recovery: "Recovery",
      mentality: "Mentality",
      vision: "Vision",
      decisionMaking: "Decision Making",
      goalkeeper: "Goalkeeper",
      setPieces: "Set Pieces",
    },
    date: "Date",
    startTime: "Start Time",
    endTime: "End Time",
    location: "Location",
    intensity: "Intensity",
    intensityOptions: {
      low: "Low",
      medium: "Medium",
      high: "High",
    },
    groups: "Groups",
    allGroups: "All groups",
    birthYears: "Birth Years",
    allBirthYears: "All birth years",
    players: "Players",
    allPlayers: "All players",
    searchPlayers: "Search players",
    objectives: "Objectives",
    sessionPlan: "Session Plan",
    equipmentNeeded: "Equipment Needed",
    notes: "Notes",
    createTraining: "Create Training",
  },
  ar: {
    createError: "تعذر إنشاء التدريب. راجع الأهداف المحددة.",
    created: "تم إنشاء {title}",
    pageTitle: "إنشاء حصة تدريب",
    pageDescription: "جدول تدريبًا للمجموعات أو سنوات الميلاد أو اللاعبين المحددين.",
    home: "الرئيسية",
    createTrainingBreadcrumb: "إنشاء تدريب",
    title: "العنوان",
    trainingFocus: "تركيز التدريب",
    focusGroups: {
      technical: "فني",
      tactical: "تكتيكي",
      physical: "بدني",
      mental: "ذهني",
      special: "خاص",
    },
    focusOptions: {
      passing: "التمرير",
      shooting: "التسديد",
      dribbling: "المراوغة",
      ballControl: "التحكم في الكرة",
      crossing: "العرضيات",
      finishing: "إنهاء الهجمة",
      attacking: "الهجوم",
      defense: "الدفاع",
      pressing: "الضغط",
      transition: "التحول",
      possession: "الاستحواذ",
      speed: "السرعة",
      agility: "الرشاقة",
      strength: "القوة",
      endurance: "التحمل",
      fitness: "اللياقة",
      recovery: "الاستشفاء",
      mentality: "العقلية",
      vision: "الرؤية",
      decisionMaking: "اتخاذ القرار",
      goalkeeper: "حارس المرمى",
      setPieces: "الكرات الثابتة",
    },
    date: "التاريخ",
    startTime: "وقت البداية",
    endTime: "وقت النهاية",
    location: "المكان",
    intensity: "الشدة",
    intensityOptions: {
      low: "منخفضة",
      medium: "متوسطة",
      high: "عالية",
    },
    groups: "المجموعات",
    allGroups: "كل المجموعات",
    birthYears: "سنوات الميلاد",
    allBirthYears: "كل سنوات الميلاد",
    players: "اللاعبون",
    allPlayers: "كل اللاعبين",
    searchPlayers: "ابحث عن لاعب",
    objectives: "الأهداف",
    sessionPlan: "خطة الحصة",
    equipmentNeeded: "المعدات المطلوبة",
    notes: "ملاحظات",
    createTraining: "إنشاء التدريب",
  },
} as const;

const toggleId = (items: string[], id: string) =>
  items.includes(id) ? items.filter((item) => item !== id) : [...items, id];

export default function CreateTrainingEventPage() {
  const language = useDashboardLanguage();
  const t = trainingCreateCopy[language];
  const { data: groups = [] } = useGetCoachGroupsScopedQuery();
  const { data: birthYears = [] } = useGetCoachBirthdaysQuery();
  const { data: playersRes } = useGetCoachPlayersScopedQuery({ limit: 200 });
  const players = useMemo(() => playersRes?.data ?? [], [playersRes?.data]);
  const [createTraining, { isLoading }] = useCreateCoachTrainingEventMutation();
  const [playerSearch, setPlayerSearch] = useState("");
  const [pageError, setPageError] = useState("");
  const [createdTitle, setCreatedTitle] = useState("");
  const [form, setForm] = useState({
    title: "",
    date: "",
    startTime: "",
    endTime: "",
    location: "",
    trainingFocus: "passing",
    intensityLevel: "medium",
    objectives: "",
    sessionPlan: "",
    equipmentNeeded: "",
    notes: "",
    allGroups: false,
    allBirthYears: false,
    allPlayers: false,
    groupIds: [] as string[],
    birthYearIds: [] as string[],
    playerIds: [] as string[],
  });

  const filteredPlayers = useMemo(() => {
    const query = playerSearch.trim().toLowerCase();
    if (!query) return players;
    return players.filter((player) =>
      `${player.full_name} ${player.position ?? ""} ${player.guardian_phone ?? ""}`
        .toLowerCase()
        .includes(query),
    );
  }, [playerSearch, players]);

  const hasTargets =
    form.allGroups ||
    form.allBirthYears ||
    form.allPlayers ||
    form.groupIds.length > 0 ||
    form.birthYearIds.length > 0 ||
    form.playerIds.length > 0;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPageError("");
    setCreatedTitle("");
    try {
      const created = await createTraining({
        title: form.title,
        groupIds: form.allGroups ? undefined : form.groupIds,
        birthYearIds: form.allBirthYears ? undefined : form.birthYearIds,
        playerIds: form.allPlayers ? undefined : form.playerIds,
        allGroups: form.allGroups,
        allBirthYears: form.allBirthYears,
        allPlayers: form.allPlayers,
        date: form.date,
        startTime: form.startTime,
        endTime: form.endTime,
        location: form.location,
        trainingFocus: form.trainingFocus,
        intensityLevel: form.intensityLevel,
        objectives: form.objectives,
        sessionPlan: form.sessionPlan,
        equipmentNeeded: form.equipmentNeeded,
        notes: form.notes,
      }).unwrap();
      setCreatedTitle(created.title);
      setForm((prev) => ({
        ...prev,
        title: "",
        objectives: "",
        sessionPlan: "",
        equipmentNeeded: "",
        notes: "",
        groupIds: [],
        birthYearIds: [],
        playerIds: [],
        allGroups: false,
        allBirthYears: false,
        allPlayers: false,
      }));
    } catch {
      setPageError(t.createError);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.pageTitle}
        description={t.pageDescription}
        breadcrumbs={[
          { label: t.home, href: "/coach/home" },
          { label: t.createTrainingBreadcrumb },
        ]}
      />

      <Card className="border-border/50 bg-card">
        <CardContent className="p-6">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {pageError && (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {pageError}
              </p>
            )}
            {createdTitle && (
              <p className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                <Check className="h-4 w-4" />
                {t.created.replace("{title}", createdTitle)}
              </p>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t.title}</Label>
                <Input
                  value={form.title}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, title: event.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{t.trainingFocus}</Label>
                <Select
                  value={form.trainingFocus}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, trainingFocus: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {focusGroups.flatMap((group) =>
                      group.options.map(([value, labelKey]) => (
                        <SelectItem key={value} value={value}>
                          {t.focusGroups[group.labelKey]} - {t.focusOptions[labelKey]}
                        </SelectItem>
                      )),
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t.date}</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, date: event.target.value }))
                  }
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>{t.startTime}</Label>
                  <Input
                    type="time"
                    value={form.startTime}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        startTime: event.target.value,
                      }))
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t.endTime}</Label>
                  <Input
                    type="time"
                    value={form.endTime}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        endTime: event.target.value,
                      }))
                    }
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t.location}</Label>
                <Input
                  value={form.location}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      location: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{t.intensity}</Label>
                <Select
                  value={form.intensityLevel}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, intensityLevel: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">{t.intensityOptions.low}</SelectItem>
                    <SelectItem value="medium">{t.intensityOptions.medium}</SelectItem>
                    <SelectItem value="high">{t.intensityOptions.high}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <TargetBlock
                title={t.groups}
                allLabel={t.allGroups}
                allChecked={form.allGroups}
                onAllChange={(checked) =>
                  setForm((prev) => ({
                    ...prev,
                    allGroups: checked,
                    groupIds: checked ? [] : prev.groupIds,
                  }))
                }
              >
                {groups.map((group) => (
                  <label
                    key={group.group_id}
                    className="flex items-center gap-2 rounded-md border border-border/40 px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={form.groupIds.includes(group.group_id)}
                      disabled={form.allGroups}
                      onChange={() =>
                        setForm((prev) => ({
                          ...prev,
                          groupIds: toggleId(prev.groupIds, group.group_id),
                        }))
                      }
                    />
                    <span>{group.group_name}</span>
                  </label>
                ))}
              </TargetBlock>

              <TargetBlock
                title={t.birthYears}
                allLabel={t.allBirthYears}
                allChecked={form.allBirthYears}
                onAllChange={(checked) =>
                  setForm((prev) => ({
                    ...prev,
                    allBirthYears: checked,
                    birthYearIds: checked ? [] : prev.birthYearIds,
                  }))
                }
              >
                {birthYears.map((birthYear) => (
                  <label
                    key={birthYear.id}
                    className="flex items-center gap-2 rounded-md border border-border/40 px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={form.birthYearIds.includes(birthYear.id)}
                      disabled={form.allBirthYears}
                      onChange={() =>
                        setForm((prev) => ({
                          ...prev,
                          birthYearIds: toggleId(prev.birthYearIds, birthYear.id),
                        }))
                      }
                    />
                    <span>{birthYear.label}</span>
                  </label>
                ))}
              </TargetBlock>

              <TargetBlock
                title={t.players}
                allLabel={t.allPlayers}
                allChecked={form.allPlayers}
                onAllChange={(checked) =>
                  setForm((prev) => ({
                    ...prev,
                    allPlayers: checked,
                    playerIds: checked ? [] : prev.playerIds,
                  }))
                }
              >
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    value={playerSearch}
                    onChange={(event) => setPlayerSearch(event.target.value)}
                    placeholder={t.searchPlayers}
                  />
                </div>
                <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                  {filteredPlayers.map((player) => (
                    <label
                      key={player.id}
                      className="flex items-center justify-between gap-2 rounded-md border border-border/40 px-3 py-2 text-sm"
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={form.playerIds.includes(player.id)}
                          disabled={form.allPlayers}
                          onChange={() =>
                            setForm((prev) => ({
                              ...prev,
                              playerIds: toggleId(prev.playerIds, player.id),
                            }))
                          }
                        />
                        {player.full_name}
                      </span>
                      {player.position && (
                        <Badge variant="outline">{player.position}</Badge>
                      )}
                    </label>
                  ))}
                </div>
              </TargetBlock>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <Label>{t.objectives}</Label>
                <Textarea
                  value={form.objectives}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      objectives: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{t.sessionPlan}</Label>
                <Textarea
                  value={form.sessionPlan}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      sessionPlan: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{t.equipmentNeeded}</Label>
                <Textarea
                  value={form.equipmentNeeded}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      equipmentNeeded: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{t.notes}</Label>
                <Textarea
                  value={form.notes}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, notes: event.target.value }))
                  }
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading || !hasTargets}
              className="gap-2"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {t.createTraining}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function TargetBlock({
  title,
  allLabel,
  allChecked,
  onAllChange,
  children,
}: {
  title: string;
  allLabel: string;
  allChecked: boolean;
  onAllChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3 rounded-md border border-border/50 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium">{title}</p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={allChecked}
            onChange={(event) => onAllChange(event.target.checked)}
          />
          {allLabel}
        </label>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
