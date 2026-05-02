import { z } from "zod";

export const FileSummarySchema = z.object({
  purpose: z.string(),
  mainExports: z.array(z.string()),
  importantFunctions: z.array(z.string()),
  importantClasses: z.array(z.string()),
  externalDependencies: z.array(z.string()),
  sideEffects: z.array(z.string())
});

export type FileSummary = z.infer<typeof FileSummarySchema>;

export type StoredFileSummary = {
  filePath: string;
  summary: FileSummary;
  model: string;
  createdAt: string;
};
