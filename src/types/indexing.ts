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
  mountsFound: number;
  middlewareFound: number;
  callGraphNodesFound: number;
  callGraphEdgesFound: number;
  summariesCreated: number;
  skippedFiles: number;
};
