import { adjudicateRecipeFailure, type FailureAdjudication } from "../failureAdjudicator";
import type { AiTaskSettingRecord } from "../taskSettings";
import type { CiaFailureFixture } from "./ciaFixtureExport";

export async function replayCiaFailureFixture(
  fixture: CiaFailureFixture,
  options?: {
    taskSetting?: AiTaskSettingRecord | null;
  }
): Promise<FailureAdjudication> {
  const packet = fixture.packet;

  return adjudicateRecipeFailure({
    flow: fixture.flow,
    taskSetting: options?.taskSetting ?? null,
    failureKind: fixture.failure_kind,
    userMessage: typeof packet.userMessage === "string" ? packet.userMessage : null,
    instruction: typeof packet.instruction === "string" ? packet.instruction : null,
    rawRecipeText: typeof packet.rawRecipeText === "string" ? packet.rawRecipeText : null,
    conversationHistory: Array.isArray(packet.conversationHistory) ? (packet.conversationHistory as never[]) : null,
    selectedDirection:
      packet.selectedDirection && typeof packet.selectedDirection === "object" && !Array.isArray(packet.selectedDirection)
        ? (packet.selectedDirection as never)
        : null,
    cookingBrief:
      packet.cookingBrief && typeof packet.cookingBrief === "object" && !Array.isArray(packet.cookingBrief)
        ? (packet.cookingBrief as never)
        : null,
    recipeCandidate: packet.recipeCandidate ?? null,
    verification:
      packet.verification && typeof packet.verification === "object" && !Array.isArray(packet.verification)
        ? (packet.verification as never)
        : null,
    reasons: Array.isArray(packet.reasons) ? packet.reasons.filter((value): value is string => typeof value === "string") : null,
    rawModelOutput: packet.rawModelOutput ?? null,
  });
}
