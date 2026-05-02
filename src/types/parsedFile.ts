import type {
  ClassRecord,
  ExportRecord,
  FunctionRecord,
  FunctionCallRecord,
  ImportRecord,
  MethodRecord,
  MiddlewareRecord,
  RouteRecord,
  SymbolRecord
} from "./records.js";

export type ParsedFile = {
  filePath: string;
  imports: ImportRecord[];
  exports: ExportRecord[];
  functions: FunctionRecord[];
  classes: ClassRecord[];
  methods: MethodRecord[];
  functionCalls: FunctionCallRecord[];
  routes: RouteRecord[];
  middleware: MiddlewareRecord[];
  symbols: SymbolRecord[];
};
