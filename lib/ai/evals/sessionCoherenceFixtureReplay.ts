import { compileCookingBrief } from "../briefCompiler";
import { mergeSessionConversationHistory, updateCanonicalSessionState } from "../sessionContext";
import { detectSessionContradictions } from "../sessionContradictions";
import { verifyRecipeAgainstBrief } from "../recipeVerifier";
import type { AIMessage } from "../chatPromptBuilder";
import type { CanonicalRecipeSessionState } from "../contracts/sessionState";
import type { AiConversationScope } from "../briefStore";

type FixtureMessage = {
  role: "user" | "assistant";
  content: string;
};

type FixtureTurn = {
  role: "user" | "assistant";
  message: string;
};

export type SessionCoherenceFixture =
  | {
      id: string;
      kind: "cropped_option_tail";
      conversation_key: string;
      scope: AiConversationScope;
      persisted_turns: FixtureTurn[];
      client_history: FixtureMessage[];
      latest_user_message: string;
      previous_state?: CanonicalRecipeSessionState | null;
      expected: {
        history_anchor_hint: string;
        active_dish_hint: string;
        merged_turn_count: number;
        last_user_message: string;
      };
    }
  | {
      id: string;
      kind: "locked_recipe_drift";
      conversation_key: string;
      scope: AiConversationScope;
      brief_prompt: string;
      user_message: string;
      session_state: CanonicalRecipeSessionState;
      recipe: {
        title: string;
        description: string | null;
        ingredients: Array<{ name: string }>;
        steps: Array<{ text: string }>;
      };
      expected: {
        contradiction_kinds: string[];
        verification_passes: boolean;
        selected_direction_match: boolean;
        required_techniques_present: boolean;
        equipment_limits_present: boolean;
      };
    };

export function replaySessionCoherenceFixture(fixture: SessionCoherenceFixture) {
  if (fixture.kind === "cropped_option_tail") {
    const persistedTurns = fixture.persisted_turns.map((turn, index) => ({
      id: `turn-${index + 1}`,
      owner_id: "fixture",
      conversation_key: fixture.conversation_key,
      scope: fixture.scope,
      recipe_id: null,
      version_id: null,
      role: turn.role,
      message: turn.message,
      metadata_json: null,
      created_at: new Date(index + 1).toISOString(),
    }));
    const mergedHistory = mergeSessionConversationHistory({
      persistedTurns,
      clientHistory: fixture.client_history as AIMessage[],
      maxMessages: 12,
    });
    const fullHistory = [...mergedHistory, { role: "user" as const, content: fixture.latest_user_message }];
    const brief = compileCookingBrief({
      userMessage: fixture.latest_user_message,
      conversationHistory: fullHistory,
    });
    const state = updateCanonicalSessionState({
      conversationKey: fixture.conversation_key,
      scope: fixture.scope,
      brief,
      conversationHistory: fullHistory,
      previousState: fixture.previous_state ?? null,
      updatedBy: "fixture_replay",
    });

    return {
      merged_turn_count: fullHistory.length,
      history_anchor: fullHistory.find((message) => message.role === "user")?.content ?? null,
      active_dish_title: state.active_dish.title,
      last_user_message: state.conversation.last_user_message,
    };
  }

  const brief = compileCookingBrief({
    userMessage: fixture.brief_prompt,
    conversationHistory: [],
  });
  const contradictions = detectSessionContradictions(fixture.session_state, fixture.user_message);
  const verification = verifyRecipeAgainstBrief({
    brief,
    recipe: fixture.recipe,
    sessionState: fixture.session_state,
  });

  return {
    contradiction_kinds: contradictions.map((item) => item.kind),
    verification_passes: verification.passes,
    selected_direction_match: verification.checks.selected_direction_match ?? true,
    required_techniques_present: verification.checks.required_techniques_present ?? true,
    equipment_limits_present: verification.checks.equipment_limits_present ?? true,
  };
}
