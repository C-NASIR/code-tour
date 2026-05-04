import type { RouteBehavior, RouteBehaviorBuildContext } from "./behaviorTypes.js";
import { buildRouteBehavior } from "./buildRouteBehavior.js";

/**
 * Semantic wrapper around route behavior construction for the Phase 3 read
 * path.
 */
export function extractRouteBehavior(context: RouteBehaviorBuildContext): RouteBehavior {
  return buildRouteBehavior(context);
}
