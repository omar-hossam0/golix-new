export type InjuryRiskPositionGroup = "Defender" | "Midfielder" | "Forward";

export const injuryRiskPositionGroups: Record<
  InjuryRiskPositionGroup,
  string[]
> = {
  Defender: ["GK", "LB", "CB", "RB"],
  Midfielder: ["CDM", "LM", "CM", "RM"],
  Forward: ["LW", "ST", "RW", "CF"],
};

export function normalizeInjuryRiskPositionGroup(
  position?: string | null,
): InjuryRiskPositionGroup {
  const value = String(position || "").trim().toUpperCase();
  for (const [group, labels] of Object.entries(injuryRiskPositionGroups)) {
    if (labels.includes(value)) {
      return group as InjuryRiskPositionGroup;
    }
  }

  if (["LCB", "RCB", "LWB", "RWB"].includes(value)) {
    return "Defender";
  }
  if (["LCM", "RCM", "LDM", "RDM", "LAM", "RAM", "CAM"].includes(value)) {
    return "Midfielder";
  }
  if (["LS", "RS", "LF", "RF"].includes(value)) return "Forward";
  return "Forward";
}
