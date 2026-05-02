export type IndexingReport = {
  projectPath: string;
  filesScanned: number;
  filesParsed: number;
  importsFound: number;
  exportsFound: number;
  functionsFound: number;
  classesFound: number;
  methodsFound: number;
  functionCallsFound: number;
  routesFound: number;
  middlewareFound: number;
  summariesCreated: number;
  skippedFiles: number;
};
