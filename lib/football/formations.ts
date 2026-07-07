export interface FormationOption {
  value: string;
  label: string;
  lines: number[];
  labels: string[][];
  coordinates: Array<Array<[number, number]>>;
  notes: string;
}

export interface FormationSlot {
  id: string;
  line: "defense" | "midfield" | "attack";
  label: string;
  x: number;
  y: number;
}

type RowSpec = {
  labels: string[];
  y: number;
  xs?: number[];
};

const xsByCount: Record<number, number[]> = {
  1: [0.5],
  2: [0.36, 0.64],
  3: [0.26, 0.5, 0.74],
  4: [0.12, 0.37, 0.63, 0.88],
  5: [0.08, 0.3, 0.5, 0.7, 0.92],
};

const backFour = (y = 0.28): RowSpec => ({ labels: ["LB", "LCB", "RCB", "RB"], y, xs: [0.12, 0.37, 0.63, 0.88] });
const backThree = (y = 0.29): RowSpec => ({ labels: ["LCB", "CB", "RCB"], y, xs: [0.3, 0.5, 0.7] });
const backFive = (y = 0.29): RowSpec => ({ labels: ["LB", "LCB", "CB", "RCB", "RB"], y, xs: [0.08, 0.3, 0.5, 0.7, 0.92] });
const twoStrikers = (y = 0.84): RowSpec => ({ labels: ["LS", "RS"], y, xs: [0.38, 0.62] });
const loneStriker = (y = 0.84): RowSpec => ({ labels: ["ST"], y });
const wideFrontThree = (y = 0.82): RowSpec => ({ labels: ["LW", "ST", "RW"], y, xs: [0.14, 0.5, 0.86] });
const wideMidFour = (y = 0.56): RowSpec => ({ labels: ["LM", "LCM", "RCM", "RM"], y, xs: [0.12, 0.37, 0.63, 0.88] });

function formation(value: string, label: string, rows: RowSpec[], notes: string): FormationOption {
  return {
    value,
    label,
    lines: rows.map((row) => row.labels.length),
    labels: rows.map((row) => row.labels),
    coordinates: rows.map((row) => {
      const xs = row.xs ?? xsByCount[row.labels.length] ?? [0.5];
      return row.labels.map((_, index) => [xs[index] ?? 0.5, row.y]);
    }),
    notes,
  };
}

function fc26PositionLabel(label: string) {
  const displayLabels: Record<string, string> = {
    LCB: "CB",
    RCB: "CB",
    LCM: "CM",
    RCM: "CM",
    LDM: "CDM",
    RDM: "CDM",
    CAM: "CAM",
    LAM: "CAM",
    RAM: "CAM",
    LWB: "LB",
    RWB: "RB",
    LF: "LW",
    RF: "RW",
    LS: "ST",
    RS: "ST",
  };
  return displayLabels[label] ?? label;
}

export const FORMATIONS: FormationOption[] = [
  formation("3-1-4-2", "3-1-4-2", [
    backThree(),
    { labels: ["CDM"], y: 0.39 },
    wideMidFour(0.6),
    twoStrikers(0.84),
  ], "FC 26 3-back attacking shape with one holder, four midfielders, and two strikers."),
  formation("3-4-1-2", "3-4-1-2", [
    backThree(),
    wideMidFour(0.5),
    { labels: ["CAM"], y: 0.68 },
    twoStrikers(0.85),
  ], "FC 26 narrow attacking 3-back shape with a CAM behind two strikers."),
  formation("3-4-2-1", "3-4-2-1", [
    backThree(),
    wideMidFour(0.49),
    { labels: ["LF", "RF"], y: 0.7, xs: [0.35, 0.65] },
    loneStriker(0.86),
  ], "FC 26 3-back attacking shape with two inside forwards supporting one striker."),
  formation("3-4-3", "3-4-3", [
    backThree(),
    wideMidFour(0.5),
    wideFrontThree(0.82),
  ], "FC 26 high attacking 3-back shape with front-three width."),
  formation("3-4-3-flat", "3-4-3 Flat", [
    backThree(),
    { labels: ["LM", "CM", "CM", "RM"], y: 0.51, xs: [0.09, 0.39, 0.61, 0.91] },
    wideFrontThree(0.82),
  ], "FC 26 flat 3-4-3 with a level midfield four and wide front three."),
  formation("3-5-2", "3-5-2", [
    backThree(),
    { labels: ["LM", "LCM", "CDM", "RCM", "RM"], y: 0.52, xs: [0.07, 0.33, 0.5, 0.67, 0.93] },
    twoStrikers(0.84),
  ], "FC 26 balanced 3-back with five across midfield and two strikers."),

  formation("4-1-2-1-2", "4-1-2-1-2", [
    backFour(),
    { labels: ["CDM"], y: 0.36 },
    { labels: ["LM", "RM"], y: 0.58, xs: [0.14, 0.86] },
    { labels: ["CAM"], y: 0.72 },
    twoStrikers(0.86),
  ], "FC 26 4-4-2 attacking diamond with side midfield width."),
  formation("4-1-2-1-2-2", "4-1-2-1-2 (2)", [
    backFour(),
    { labels: ["CDM"], y: 0.36 },
    { labels: ["LCM", "RCM"], y: 0.57, xs: [0.34, 0.66] },
    { labels: ["CAM"], y: 0.72 },
    twoStrikers(0.86),
  ], "FC 26 narrow 4-1-2-1-2 variant with two central midfielders."),
  formation("4-1-2-1-2-narrow", "4-1-2-1-2 Narrow", [
    backFour(),
    { labels: ["CDM"], y: 0.35 },
    { labels: ["LCM", "RCM"], y: 0.57, xs: [0.36, 0.64] },
    { labels: ["CAM"], y: 0.72 },
    { labels: ["LS", "RS"], y: 0.86, xs: [0.38, 0.62] },
  ], "FC 26 narrow diamond built for central combinations."),
  formation("4-1-2-1-2-wide", "4-1-2-1-2 Wide", [
    backFour(),
    { labels: ["CDM"], y: 0.36 },
    { labels: ["LM", "RM"], y: 0.58, xs: [0.09, 0.91] },
    { labels: ["CAM"], y: 0.72 },
    twoStrikers(0.86),
  ], "FC 26 wide diamond where LM and RM provide the main width."),
  formation("4-1-3-2", "4-1-3-2", [
    backFour(),
    { labels: ["CDM"], y: 0.36 },
    { labels: ["LM", "CM", "RM"], y: 0.62, xs: [0.1, 0.5, 0.9] },
    twoStrikers(0.86),
  ], "FC 26 balanced attacking 4-back with one holder and three advanced midfielders."),
  formation("4-1-4-1", "4-1-4-1", [
    backFour(),
    { labels: ["CDM"], y: 0.36 },
    wideMidFour(0.62),
    loneStriker(0.86),
  ], "FC 26 defensive and balanced shape with one holding midfielder and a midfield four."),
  formation("4-2-1-3", "4-2-1-3", [
    backFour(),
    { labels: ["LDM", "RDM"], y: 0.39, xs: [0.34, 0.66] },
    { labels: ["CAM"], y: 0.62 },
    wideFrontThree(0.85),
  ], "FC 26 attacking and possession shape with two holders, a CAM, and three forwards."),
  formation("4-2-2-2", "4-2-2-2", [
    backFour(),
    { labels: ["LDM", "RDM"], y: 0.39, xs: [0.33, 0.67] },
    { labels: ["LAM", "RAM"], y: 0.65, xs: [0.24, 0.76] },
    twoStrikers(0.86),
  ], "FC 26 compact attacking shape with two CDMs, two wide CAMs, and two strikers."),
  formation("4-2-3-1", "4-2-3-1", [
    backFour(),
    { labels: ["LDM", "RDM"], y: 0.38, xs: [0.34, 0.66] },
    { labels: ["LM", "CAM", "RM"], y: 0.65, xs: [0.11, 0.5, 0.89] },
    loneStriker(0.86),
  ], "FC 26 balanced and defensive 4-5-1 base with two holding midfielders."),
  formation("4-2-3-1-2", "4-2-3-1 (2)", [
    backFour(),
    { labels: ["LDM", "RDM"], y: 0.38, xs: [0.35, 0.65] },
    { labels: ["LAM", "CAM", "RAM"], y: 0.66, xs: [0.31, 0.5, 0.69] },
    loneStriker(0.86),
  ], "FC 26 narrow 4-2-3-1 with three central attacking midfielders."),
  formation("4-2-3-1-narrow", "4-2-3-1 Narrow", [
    backFour(),
    { labels: ["LDM", "RDM"], y: 0.38, xs: [0.35, 0.65] },
    { labels: ["LAM", "CAM", "RAM"], y: 0.66, xs: [0.32, 0.5, 0.68] },
    loneStriker(0.86),
  ], "FC 26 compact 4-2-3-1 focused on central control."),
  formation("4-2-3-1-wide", "4-2-3-1 Wide", [
    backFour(),
    { labels: ["LDM", "RDM"], y: 0.38, xs: [0.34, 0.66] },
    { labels: ["LW", "CAM", "RW"], y: 0.66, xs: [0.09, 0.5, 0.91] },
    loneStriker(0.86),
  ], "FC 26 wide 4-2-3-1 with natural attacking width."),
  formation("4-2-4", "4-2-4", [
    backFour(),
    { labels: ["LCM", "RCM"], y: 0.48, xs: [0.33, 0.67] },
    { labels: ["LW", "LS", "RS", "RW"], y: 0.84, xs: [0.08, 0.36, 0.64, 0.92] },
  ], "FC 26 attacking shape with four forwards and two central midfielders."),
  formation("4-3-1-2", "4-3-1-2", [
    backFour(),
    { labels: ["LCM", "CM", "RCM"], y: 0.45, xs: [0.29, 0.5, 0.71] },
    { labels: ["CAM"], y: 0.68 },
    twoStrikers(0.86),
  ], "FC 26 narrow central overload with a CAM behind two strikers."),
  formation("4-3-2-1", "4-3-2-1", [
    backFour(),
    { labels: ["LCM", "CM", "RCM"], y: 0.45, xs: [0.29, 0.5, 0.71] },
    { labels: ["LF", "RF"], y: 0.69, xs: [0.36, 0.64] },
    loneStriker(0.87),
  ], "FC 26 Christmas tree shape with two inside forwards and one striker."),
  formation("4-3-3", "4-3-3", [
    backFour(),
    { labels: ["LCM", "CM", "RCM"], y: 0.52, xs: [0.28, 0.5, 0.72] },
    wideFrontThree(0.84),
  ], "FC 26 attacking wide 4-3-3 with three central midfielders."),
  formation("4-3-3-2", "4-3-3 (2)", [
    backFour(),
    { labels: ["LCM", "CDM", "RCM"], y: 0.51, xs: [0.3, 0.5, 0.7] },
    wideFrontThree(0.84),
  ], "FC 26 balanced and defensive 4-3-3 with a holding midfielder."),
  formation("4-3-3-3", "4-3-3 (3)", [
    backFour(),
    { labels: ["LDM", "CM", "RDM"], y: 0.48, xs: [0.33, 0.5, 0.67] },
    wideFrontThree(0.84),
  ], "FC 26 compact possession 4-3-3 with deeper midfield support."),
  formation("4-3-3-4", "4-3-3 (4)", [
    backFour(),
    { labels: ["LCM", "CAM", "RCM"], y: 0.55, xs: [0.3, 0.5, 0.7] },
    wideFrontThree(0.85),
  ], "FC 26 balanced and wide 4-3-3 with an advanced central creator."),
  formation("4-3-3-attack", "4-3-3 Attack", [
    backFour(),
    { labels: ["LCM", "CAM", "RCM"], y: 0.57, xs: [0.29, 0.5, 0.71] },
    wideFrontThree(0.86),
  ], "FC 26 high-press attacking 4-3-3."),
  formation("4-3-3-defend", "4-3-3 Defend", [
    backFour(),
    { labels: ["LDM", "CDM", "RDM"], y: 0.43, xs: [0.31, 0.5, 0.69] },
    wideFrontThree(0.83),
  ], "FC 26 defensive 4-3-3 with three deeper midfielders."),
  formation("4-3-3-flat", "4-3-3 Flat", [
    backFour(),
    { labels: ["LCM", "CM", "RCM"], y: 0.52, xs: [0.29, 0.5, 0.71] },
    wideFrontThree(0.84),
  ], "FC 26 flat balanced wide 4-3-3."),
  formation("4-3-3-holding", "4-3-3 Holding", [
    backFour(),
    { labels: ["LCM", "CDM", "RCM"], y: 0.5, xs: [0.3, 0.5, 0.7] },
    wideFrontThree(0.84),
  ], "FC 26 4-3-3 with a holding midfielder for defensive control."),
  formation("4-4-1-1-2", "4-4-1-1 (2)", [
    backFour(),
    wideMidFour(0.53),
    { labels: ["CF"], y: 0.72 },
    loneStriker(0.87),
  ], "FC 26 4-5-1 attacking base with a second striker or CF."),
  formation("4-4-1-1-midfield", "4-4-1-1 Midfield", [
    backFour(),
    wideMidFour(0.52),
    { labels: ["CAM"], y: 0.71 },
    loneStriker(0.86),
  ], "FC 26 midfield-control 4-4-1-1 with a creator behind the striker."),
  formation("4-4-2", "4-4-2", [
    backFour(),
    wideMidFour(0.53),
    twoStrikers(0.84),
  ], "FC 26 balanced classic 4-4-2."),
  formation("4-4-2-2", "4-4-2 (2)", [
    backFour(),
    { labels: ["LM", "LDM", "RDM", "RM"], y: 0.51, xs: [0.09, 0.36, 0.64, 0.91] },
    twoStrikers(0.84),
  ], "FC 26 defensive and balanced 4-4-2 with two holding midfielders."),
  formation("4-4-2-flat", "4-4-2 Flat", [
    backFour(),
    { labels: ["LM", "LCM", "RCM", "RM"], y: 0.53, xs: [0.09, 0.36, 0.64, 0.91] },
    twoStrikers(0.84),
  ], "FC 26 flat balanced 4-4-2."),
  formation("4-4-2-holding", "4-4-2 Holding", [
    backFour(),
    { labels: ["LM", "LDM", "RDM", "RM"], y: 0.5, xs: [0.09, 0.36, 0.64, 0.91] },
    twoStrikers(0.84),
  ], "FC 26 defensive 4-4-2 with two deeper central midfielders."),
  formation("4-5-1", "4-5-1", [
    backFour(),
    { labels: ["LM", "LCM", "CM", "RCM", "RM"], y: 0.54, xs: [0.08, 0.31, 0.5, 0.69, 0.92] },
    loneStriker(0.85),
  ], "FC 26 defensive midfield-control 4-5-1."),
  formation("4-5-1-2", "4-5-1 (2)", [
    backFour(),
    { labels: ["LM", "LCM", "CDM", "RCM", "RM"], y: 0.53, xs: [0.08, 0.31, 0.5, 0.69, 0.92] },
    loneStriker(0.85),
  ], "FC 26 attacking and midfield-control 4-5-1 variant."),
  formation("4-5-1-attack", "4-5-1 Attack", [
    backFour(),
    { labels: ["LM", "LAM", "CAM", "RAM", "RM"], y: 0.62, xs: [0.08, 0.31, 0.5, 0.69, 0.92] },
    loneStriker(0.87),
  ], "FC 26 attacking 4-5-1 with advanced midfield support."),
  formation("4-5-1-flat", "4-5-1 Flat", [
    backFour(),
    { labels: ["LM", "LCM", "CM", "RCM", "RM"], y: 0.52, xs: [0.08, 0.31, 0.5, 0.69, 0.92] },
    loneStriker(0.84),
  ], "FC 26 flat defensive 4-5-1 for midfield control."),

  formation("5-2-1-2", "5-2-1-2", [
    backFive(),
    { labels: ["LCM", "RCM"], y: 0.49, xs: [0.34, 0.66] },
    { labels: ["CAM"], y: 0.68 },
    twoStrikers(0.85),
  ], "FC 26 5-3-2 base with a CAM behind two strikers."),
  formation("5-2-3", "5-2-3", [
    backFive(),
    { labels: ["LCM", "RCM"], y: 0.49, xs: [0.34, 0.66] },
    wideFrontThree(0.84),
  ], "FC 26 defensive and counter-attacking 5-back with front-three outlets."),
  formation("5-3-2", "5-3-2", [
    backFive(),
    { labels: ["LCM", "CM", "RCM"], y: 0.53, xs: [0.3, 0.5, 0.7] },
    twoStrikers(0.84),
  ], "FC 26 defensive and balanced 5-back with three central midfielders."),
  formation("5-3-2-holding", "5-3-2 Holding", [
    backFive(),
    { labels: ["LDM", "CDM", "RDM"], y: 0.5, xs: [0.31, 0.5, 0.69] },
    twoStrikers(0.84),
  ], "FC 26 holding 5-3-2 with a deeper midfield line."),
  formation("5-4-1", "5-4-1", [
    backFive(),
    wideMidFour(0.54),
    loneStriker(0.84),
  ], "FC 26 ultra-defensive and counter-attacking 5-4-1."),
  formation("5-4-1-flat", "5-4-1 Flat", [
    backFive(),
    { labels: ["LM", "LCM", "RCM", "RM"], y: 0.52, xs: [0.08, 0.35, 0.65, 0.92] },
    loneStriker(0.83),
  ], "FC 26 flat ultra-defensive 5-4-1."),
];

export function getFormationSlots(formationValue: string): FormationSlot[] {
  const option = FORMATIONS.find((item) => item.value === formationValue) ?? FORMATIONS[0];
  const rows = option.lines;
  const outfieldSlots: FormationSlot[] = rows.flatMap((count, rowIndex) => {
    const isDefense = rowIndex === 0;
    const isAttack = rowIndex === rows.length - 1;
    const labels = option.labels[rowIndex] ?? [];
    const coordinates = option.coordinates[rowIndex] ?? [];
    return Array.from({ length: count }, (_, index) => {
      const [x, y] = coordinates[index] ?? [0.5, 0.5];
      return {
        id: `${formationValue}-${rowIndex}-${index}`,
        line: isDefense ? "defense" : isAttack ? "attack" : "midfield",
        label: fc26PositionLabel(labels?.[index] ?? `P${rowIndex + 1}${index + 1}`),
        x,
        y,
      };
    });
  });
  return [
    {
      id: `${formationValue}-gk`,
      line: "defense",
      label: "GK",
      x: 0.5,
      y: 0.08,
    },
    ...outfieldSlots,
  ];
}

