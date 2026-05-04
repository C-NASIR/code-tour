import OpenAI from "openai";
import { getSummaryEnv } from "./openaiClient.js";
import type { FunctionBehavior, RouteBehavior } from "../behavior/behaviorTypes.js";

/**
 * Creates the optional AI explainer for Phase 3 behavior reports.
 *
 * The model receives only one deterministic behavior object at a time and is
 * explicitly instructed to separate facts from uncertainty.
 */
export function createOpenAIBehaviorExplainer(
  env: NodeJS.ProcessEnv = process.env
): {
  model: string;
  explainBehavior: (behavior: RouteBehavior | FunctionBehavior) => Promise<string>;
} {
  const summaryEnv = getSummaryEnv(env);
  const client = new OpenAI({
    apiKey: summaryEnv.OPENAI_API_KEY,
  });

  return {
    model: summaryEnv.OPENAI_MODEL,
    explainBehavior: async (behavior: RouteBehavior | FunctionBehavior) => {
      const response = await client.responses.create({
        model: summaryEnv.OPENAI_MODEL,
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text:
                  "Explain the supplied behavior object using only the structured evidence. Do not invent files, functions, routes, services, database tables, external systems, or side effects. Separate confirmed facts from uncertainty.",
              },
            ],
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: JSON.stringify(behavior, null, 2),
              },
            ],
          },
        ],
      });

      return response.output_text.trim();
    },
  };
}
