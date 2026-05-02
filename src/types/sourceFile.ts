export type SourceLanguage = "ts" | "js";

export type SourceFileRecord = {
  id: string;
  path: string;
  absolutePath: string;
  language: SourceLanguage;
  content: string;
  hash: string;
  size: number;
};

export type ScanProjectResult = {
  files: SourceFileRecord[];
  skippedFiles: number;
};
