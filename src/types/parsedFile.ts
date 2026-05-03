import type {
  ClassRecord,
  ExpressMountRecord,
  ExportRecord,
  FunctionRecord,
  FunctionCallRecord,
  ImportRecord,
  MethodRecord,
  MiddlewareRecord,
  ObjectMethodRecord,
  RouteRecord,
  SymbolRecord
} from "./records.js";
import type { CallGraphEdge, CallGraphNode } from "../graph/callGraphTypes.js";
import type { SourceFile } from "ts-morph";

export type ParsedFile = {
  filePath: string;
  sourceFile: SourceFile;
  imports: ImportRecord[];
  exports: ExportRecord[];
  functions: FunctionRecord[];
  classes: ClassRecord[];
  methods: MethodRecord[];
  objectMethods: ObjectMethodRecord[];
  functionCalls: FunctionCallRecord[];
  routes: RouteRecord[];
  middleware: MiddlewareRecord[];
  expressMounts: ExpressMountRecord[];
  callGraphNodes: CallGraphNode[];
  callGraphEdges: CallGraphEdge[];
  symbols: SymbolRecord[];
};
