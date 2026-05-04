import { Node, SyntaxKind } from "ts-morph";
import type { AliasBinding, DataRead, ExtractionContext } from "./behaviorTypes.js";
import { createEvidence } from "./classifyBehavior.js";

function normalizeAccessText(text: string): string {
  return text.replace(/\?\./g, ".");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function createDataRead(
  context: ExtractionContext,
  source: DataRead["source"],
  name: string,
  text: string,
  line: number
): DataRead {
  return {
    source,
    name,
    evidence: createEvidence(context.filePath, line, text, context.confidence),
  };
}

function getRequestSourceFromText(
  text: string,
  requestParamNames: Set<string>
): Pick<DataRead, "source" | "name"> | null {
  const normalized = normalizeAccessText(text);

  for (const requestParamName of requestParamNames) {
    const escapedName = escapeRegExp(requestParamName);
    const matchers: Array<{ regex: RegExp; source: DataRead["source"]; wildcard: boolean }> = [
      { regex: new RegExp(`^${escapedName}\\.body(?:\\.(.+))?$`), source: "req_body", wildcard: true },
      { regex: new RegExp(`^${escapedName}\\.params(?:\\.(.+))?$`), source: "req_params", wildcard: true },
      { regex: new RegExp(`^${escapedName}\\.query(?:\\.(.+))?$`), source: "req_query", wildcard: true },
      { regex: new RegExp(`^${escapedName}\\.headers(?:\\.(.+))?$`), source: "req_headers", wildcard: true },
    ];

    for (const matcher of matchers) {
      const match = normalized.match(matcher.regex);

      if (match) {
        return {
          source: matcher.source,
          name: match[1] ?? "*",
        };
      }
    }
  }

  const envMatch = normalized.match(/^process\.env(?:\.(.+))?$/);

  if (envMatch) {
    return {
      source: "env",
      name: envMatch[1] ?? "*",
    };
  }

  return null;
}

function resolveReadFromExpressionText(
  context: ExtractionContext,
  expressionText: string
): Pick<DataRead, "source" | "name"> | null {
  const directMatch = getRequestSourceFromText(expressionText, context.requestParamNames);

  if (directMatch) {
    return directMatch;
  }

  const normalized = normalizeAccessText(expressionText);
  const segments = normalized.split(".");
  const alias = context.aliases.get(segments[0] ?? "");

  if (!alias || segments.length < 2) {
    return null;
  }

  const remainingPath = segments.slice(1).join(".");
  const originName =
    alias.origin.name === "*"
      ? remainingPath
      : remainingPath
        ? `${alias.origin.name}.${remainingPath}`
        : alias.origin.name;

  if (!originName) {
    return null;
  }

  return {
    source: alias.origin.source,
    name: originName,
  };
}

function shouldSkipIntermediatePropertyAccess(node: Node): boolean {
  const parent = node.getParent();

  return Boolean(
    parent &&
      Node.isPropertyAccessExpression(parent) &&
      parent.getStart() === node.getStart()
  );
}

function addRecord(records: DataRead[], seenKeys: Set<string>, record: DataRead): void {
  const key = `${record.source}:${record.name}:${record.evidence.filePath}:${record.evidence.line}:${record.evidence.text}`;

  if (seenKeys.has(key)) {
    return;
  }

  seenKeys.add(key);
  records.push(record);
}

function createAliasBinding(localName: string, origin: DataRead): AliasBinding {
  return {
    localName,
    origin,
  };
}

/**
 * Extracts direct request, environment, and local alias reads from one
 * resolved function body.
 */
export function extractDataReads(context: ExtractionContext): DataRead[] {
  const records: DataRead[] = [];
  const seenKeys = new Set<string>();

  for (const declaration of context.container.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
    const nearestFunctionAncestor = declaration.getFirstAncestor((ancestor) => Node.isFunctionLikeDeclaration(ancestor));

    if (nearestFunctionAncestor && nearestFunctionAncestor !== context.functionLike) {
      continue;
    }

    const initializer = declaration.getInitializer();
    const nameNode = declaration.getNameNode();

    if (!initializer) {
      continue;
    }

    const directRead = resolveReadFromExpressionText(context, initializer.getText());

    if (Node.isIdentifier(nameNode) && directRead) {
      const originRead = createDataRead(
        context,
        directRead.source,
        directRead.name,
        initializer.getText(),
        initializer.getStartLineNumber()
      );
      addRecord(records, seenKeys, originRead);

      const localRead = createDataRead(
        context,
        "local_variable",
        nameNode.getText(),
        declaration.getText(),
        declaration.getStartLineNumber()
      );
      addRecord(records, seenKeys, localRead);
      context.aliases.set(nameNode.getText(), createAliasBinding(nameNode.getText(), originRead));
      continue;
    }

    if (!Node.isObjectBindingPattern(nameNode) || !directRead) {
      continue;
    }

    for (const element of nameNode.getElements()) {
      const propertyNameNode = element.getPropertyNameNode();
      const bindingNameNode = element.getNameNode();
      const propertyName = propertyNameNode?.getText() ?? bindingNameNode.getText();
      const originName =
        directRead.name === "*" ? propertyName : `${directRead.name}.${propertyName}`;
      const originRead = createDataRead(
        context,
        directRead.source,
        originName,
        declaration.getText(),
        declaration.getStartLineNumber()
      );
      addRecord(records, seenKeys, originRead);

      const localRead = createDataRead(
        context,
        "local_variable",
        bindingNameNode.getText(),
        declaration.getText(),
        declaration.getStartLineNumber()
      );
      addRecord(records, seenKeys, localRead);
      context.aliases.set(bindingNameNode.getText(), createAliasBinding(bindingNameNode.getText(), originRead));
    }
  }

  for (const propertyAccess of context.container.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)) {
    const nearestFunctionAncestor = propertyAccess.getFirstAncestor((ancestor) => Node.isFunctionLikeDeclaration(ancestor));

    if (nearestFunctionAncestor && nearestFunctionAncestor !== context.functionLike) {
      continue;
    }

    if (shouldSkipIntermediatePropertyAccess(propertyAccess)) {
      continue;
    }

    const resolved = resolveReadFromExpressionText(context, propertyAccess.getText());

    if (!resolved) {
      continue;
    }

    addRecord(
      records,
      seenKeys,
      createDataRead(context, resolved.source, resolved.name, propertyAccess.getText(), propertyAccess.getStartLineNumber())
    );
  }

  for (const callExpression of context.directCallExpressions) {
    const normalized = normalizeAccessText(callExpression.getExpression().getText());

    for (const requestParamName of context.requestParamNames) {
      const escapedName = escapeRegExp(requestParamName);
      const match = normalized.match(new RegExp(`^${escapedName}\\.get$`));

      if (!match) {
        continue;
      }

      const [firstArgument] = callExpression.getArguments();

      if (!firstArgument || (!Node.isStringLiteral(firstArgument) && !Node.isNoSubstitutionTemplateLiteral(firstArgument))) {
        continue;
      }

      addRecord(
        records,
        seenKeys,
        createDataRead(
          context,
          "req_headers",
          firstArgument.getLiteralText(),
          callExpression.getText(),
          callExpression.getStartLineNumber()
        )
      );
    }
  }

  return records.sort((left, right) =>
    left.evidence.line - right.evidence.line || left.evidence.text.localeCompare(right.evidence.text)
  );
}
