import dotenv from "dotenv";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { FileSummarySchema } from "./summarySchema.js";
import type { FileSummarizer } from "./summarizeFile.js";

dotenv.config();

type SummaryEnv = {
  OPENAI_API_KEY: string;
  OPENAI_MODEL: string;
};

/**
 * Validates the environment required to generate file summaries during
 * indexing.
 *
 * Values may come from the shell environment or a local `.env` file loaded
 * when this module is initialized.
 */
export function getSummaryEnv(
  env: NodeJS.ProcessEnv = process.env,
): SummaryEnv {
  const apiKey = env.OPENAI_API_KEY?.trim();
  const model = env.OPENAI_MODEL?.trim();

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required to generate file summaries.");
  }

  if (!model) {
    throw new Error("OPENAI_MODEL is required to generate file summaries.");
  }

  return {
    OPENAI_API_KEY: apiKey,
    OPENAI_MODEL: model,
  };
}

/**
 * Creates the OpenAI-backed summarizer used by the `index` command.
 *
 * The returned summarizer enforces the shared Zod schema so summaries can be
 * stored and displayed without extra parsing logic elsewhere in the codebase.
 */
export function createOpenAIFileSummarizer(
  env: NodeJS.ProcessEnv = process.env,
): {
  model: string;
  summarizeFile: FileSummarizer;
} {
  const summaryEnv = getSummaryEnv(env);
  const client = new OpenAI({
    apiKey: summaryEnv.OPENAI_API_KEY,
  });

  return {
    model: summaryEnv.OPENAI_MODEL,
    summarizeFile: async ({ filePath, content }) => {
      const response = await client.responses.parse({
        model: summaryEnv.OPENAI_MODEL,
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text: "You are summarizing a JavaScript or TypeScript source code file. Use only the code provided. Return the required JSON object and do not invent missing details.",
              },
            ],
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `File path: ${filePath}\n\nSource code:\n${content}`,
              },
            ],
          },
        ],
        text: {
          format: zodTextFormat(FileSummarySchema, "file_summary"),
        },
      });

      const parsed = response.output_parsed;

      if (!parsed) {
        throw new Error(
          `Model did not return a structured summary for ${filePath}.`,
        );
      }

      return parsed;
    },
  };
}
