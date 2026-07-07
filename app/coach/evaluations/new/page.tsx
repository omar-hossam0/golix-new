"use client";

import { useMemo, useState } from "react";
import type { ElementType } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCreateCoachEvaluationMutation,
  useGetCoachGroupQuery,
  useGetCoachGroupsQuery,
} from "@/lib/store/api/coachApi";
import { useDashboardLanguage } from "@/lib/hooks/useDashboardLanguage";
import { getInitials } from "@/lib/utils";
import {
  Activity,
  Brain,
  CheckCircle2,
  Loader2,
  Route,
  Save,
  Star,
  Target,
} from "lucide-react";

interface EvalScores {
  technical: string;
  tactical: string;
  physical: string;
  mental: string;
  notes: string;
}

type ScoreKey = Exclude<keyof EvalScores, "notes">;

const categories: {
  key: ScoreKey;
  icon: ElementType;
}[] = [
  { key: "technical", icon: Target },
  { key: "tactical", icon: Route },
  { key: "physical", icon: Activity },
  { key: "mental", icon: Brain },
];

const emptyScores: EvalScores = {
  technical: "",
  tactical: "",
  physical: "",
  mental: "",
  notes: "",
};

const evaluationCopy = {
  en: {
    title: "New Evaluation",
    description: "Create a player evaluation",
    home: "Home",
    evaluations: "Evaluations",
    new: "New",
    groupsError: "Could not load your assigned groups.",
    group: "Group",
    loadingGroups: "Loading groups...",
    selectGroup: "Select group",
    player: "Player",
    loadingPlayers: "Loading players...",
    selectPlayer: "Select player",
    noGroups: "No groups assigned yet.",
    age: "Age",
    level: "Level",
    currentScore: "Current Score",
    categoryLabels: {
      technical: "Technical",
      tactical: "Tactical",
      physical: "Physical",
      mental: "Mental",
    } satisfies Record<ScoreKey, string>,
    overallScore: "Overall Score",
    averageHint: "Average of all 4 categories",
    coachNotes: "Coach Notes",
    notesPlaceholder: "Write detailed observations about the player's performance...",
    saveError: "Could not submit evaluation. Scores must be between 0 and 10.",
    saving: "Saving...",
    saved: "Saved",
    submit: "Submit Evaluation",
  },
  ar: {
    title: "تقييم جديد",
    description: "إنشاء تقييم للاعب",
    home: "الرئيسية",
    evaluations: "التقييمات",
    new: "جديد",
    groupsError: "تعذر تحميل المجموعات المعينة لك.",
    group: "المجموعة",
    loadingGroups: "جاري تحميل المجموعات...",
    selectGroup: "اختر مجموعة",
    player: "اللاعب",
    loadingPlayers: "جاري تحميل اللاعبين...",
    selectPlayer: "اختر لاعب",
    noGroups: "لا توجد مجموعات معينة بعد.",
    age: "العمر",
    level: "المستوى",
    currentScore: "النقاط الحالية",
    categoryLabels: {
      technical: "فني",
      tactical: "تكتيكي",
      physical: "بدني",
      mental: "ذهني",
    } satisfies Record<ScoreKey, string>,
    overallScore: "التقييم العام",
    averageHint: "متوسط الفئات الأربع",
    coachNotes: "ملاحظات المدرب",
    notesPlaceholder: "اكتب ملاحظات تفصيلية عن أداء اللاعب...",
    saveError: "تعذر إرسال التقييم. يجب أن تكون الدرجات بين 0 و10.",
    saving: "جاري الحفظ...",
    saved: "تم الحفظ",
    submit: "إرسال التقييم",
  },
} as const;

export default function CoachNewEvaluationPage() {
  const language = useDashboardLanguage();
  const t = evaluationCopy[language];
  const { data: groups = [], isLoading: loadingGroups, isError: groupsError } =
    useGetCoachGroupsQuery();
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const selectedGroup = selectedGroupId || groups[0]?.id || "";
  const [selectedPlayer, setSelectedPlayer] = useState("");
  const { data: groupDetail, isFetching: loadingPlayers } = useGetCoachGroupQuery(
    { groupId: selectedGroup },
    { skip: !selectedGroup }
  );
  const players = groupDetail?.players ?? [];
  const [scores, setScores] = useState<EvalScores>(emptyScores);
  const [saved, setSaved] = useState(false);
  const [createEvaluation, { isLoading: isSaving, error: saveError }] =
    useCreateCoachEvaluationMutation();

  const activePlayerId = players.some((player) => player.id === selectedPlayer)
    ? selectedPlayer
    : "";
  const selectedPlayerRecord = players.find((player) => player.id === activePlayerId);
  const overall = useMemo(() => {
    const values = categories.map((category) => Number(scores[category.key]));
    if (values.some((value) => !Number.isFinite(value))) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }, [scores]);

  const canSubmit =
    activePlayerId &&
    categories.every((category) => {
      const value = Number(scores[category.key]);
      return Number.isFinite(value) && value >= 0 && value <= 10;
    }) &&
    !isSaving;

  const handleSave = async () => {
    if (!canSubmit) return;

    try {
      await createEvaluation({
        playerId: activePlayerId,
        groupId: selectedGroup,
        technicalScore: Number(scores.technical),
        tacticalScore: Number(scores.tactical),
        physicalScore: Number(scores.physical),
        mentalScore: Number(scores.mental),
        notes: scores.notes.trim() || undefined,
      }).unwrap();

      setSaved(true);
      setScores(emptyScores);
      setSelectedPlayer("");
      window.setTimeout(() => setSaved(false), 2500);
    } catch {
      // Mutation error is shown below.
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.title}
        description={t.description}
        breadcrumbs={[
          { label: t.home, href: "/coach/home" },
          { label: t.evaluations },
          { label: t.new },
        ]}
      />

      {groupsError && (
        <Card className="border-red-500/30 bg-red-500/10">
          <CardContent className="p-4 text-sm text-red-300">
            {t.groupsError}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-4">
        <div className="w-full sm:w-64">
          <Label className="mb-2 block text-sm">{t.group}</Label>
          <Select
            value={selectedGroup}
            onValueChange={(value) => {
              setSelectedGroupId(value);
              setSelectedPlayer("");
            }}
            disabled={loadingGroups || groups.length === 0}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={loadingGroups ? t.loadingGroups : t.selectGroup}
              />
            </SelectTrigger>
            <SelectContent>
              {groups.map((group) => (
                <SelectItem key={group.id} value={group.id}>
                  {group.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full sm:w-64">
          <Label className="mb-2 block text-sm">{t.player}</Label>
          <Select
            value={activePlayerId}
            onValueChange={setSelectedPlayer}
            disabled={!selectedGroup || loadingPlayers || players.length === 0}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={loadingPlayers ? t.loadingPlayers : t.selectPlayer}
              />
            </SelectTrigger>
            <SelectContent>
              {players.map((player) => (
                <SelectItem key={player.id} value={player.id}>
                  {player.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!loadingGroups && groups.length === 0 && (
        <Card className="border-border/50 bg-card">
          <CardContent className="p-8 text-center text-muted-foreground">
            {t.noGroups}
          </CardContent>
        </Card>
      )}

      {selectedPlayerRecord && (
        <>
          <Card className="border-border/50 bg-card">
            <CardContent className="flex items-center gap-4 p-4">
              <Avatar className="h-14 w-14">
                <AvatarFallback className="bg-primary/20 text-primary">
                  {getInitials(selectedPlayerRecord.fullName)}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="text-lg font-semibold">
                  {selectedPlayerRecord.fullName}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {selectedPlayerRecord.position} - {t.age} {selectedPlayerRecord.age} - {t.level}{" "}
                  {selectedPlayerRecord.level}
                </p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-sm text-muted-foreground">{t.currentScore}</p>
                <p className="text-2xl font-bold text-primary">
                  {selectedPlayerRecord.performanceScore}
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {categories.map((category) => (
              <Card key={category.key} className="border-border/50 bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <category.icon className="h-4 w-4 text-primary" />
                    {t.categoryLabels[category.key]}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Input
                    type="number"
                    min="0"
                    max="10"
                    step="0.1"
                    placeholder="0.0 - 10.0"
                    value={scores[category.key]}
                    onChange={(event) =>
                      setScores((prev) => ({
                        ...prev,
                        [category.key]: event.target.value,
                      }))
                    }
                    className="text-center text-2xl font-bold"
                  />
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="flex items-center justify-between p-6">
              <div className="flex items-center gap-3">
                <Star className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">{t.overallScore}</p>
                  <p className="text-3xl font-bold text-primary">
                    {overall === null ? "--" : overall.toFixed(1)}
                  </p>
                </div>
              </div>
              <div className="text-right text-sm text-muted-foreground">
                {t.averageHint}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t.coachNotes}</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                className="min-h-[120px]"
                placeholder={t.notesPlaceholder}
                value={scores.notes}
                onChange={(event) =>
                  setScores((prev) => ({ ...prev, notes: event.target.value }))
                }
              />
            </CardContent>
          </Card>

          {saveError && (
            <p className="text-sm text-red-400">
              {t.saveError}
            </p>
          )}

          <div className="flex justify-end">
            <Button
              size="lg"
              onClick={handleSave}
              disabled={!canSubmit}
              className={saved ? "bg-lime-300 text-slate-950 hover:bg-lime-200" : ""}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  {t.saving}
                </>
              ) : saved ? (
                <>
                  <CheckCircle2 className="mr-2 h-5 w-5" />
                  {t.saved}
                </>
              ) : (
                <>
                  <Save className="mr-2 h-5 w-5" />
                  {t.submit}
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
