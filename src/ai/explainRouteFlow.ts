import OpenAI from "openai";
import { getSummaryEnv } from "./openaiClient.js";
import type { RouteFlow } from "../flow/flowTypes.js";

export function createOpenAIRouteFlowExplainer(
  env: NodeJS.ProcessEnv = process.env
): {
  model: string;
  explainRouteFlow: (flow: RouteFlow) => Promise<string>;
} {
  const summaryEnv = getSummaryEnv(env);
  const client = new OpenAI({
    apiKey: summaryEnv.OPENAI_API_KEY,
  });

  return {
    model: summaryEnv.OPENAI_MODEL,
    explainRouteFlow: async (flow: RouteFlow) => {
      const response = await client.responses.create({
        model: summaryEnv.OPENAI_MODEL,
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text: "Explain the traced Express request flow using only the supplied structured evidence. Do not infer steps that are not present.",
              },
            ],
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: JSON.stringify(flow, null, 2),
              },
            ],
          },
        ],
      });

      return response.output_text.trim();
    },
  };
}
