import type { CallGraphEdge, CallGraphNode } from "../graph/callGraphTypes.js";
import type { ProjectDatabase } from "./db.js";

export function insertCallGraphNodes(db: ProjectDatabase, nodes: CallGraphNode[]): void {
  const statement = db.prepare(
    `INSERT INTO call_graph_nodes (id, file_path, kind, name, qualified_name, start_line, end_line)
     VALUES (@id, @filePath, @kind, @name, @qualifiedName, @startLine, @endLine)`
  );

  for (const node of nodes) {
    statement.run(node);
  }
}

export function insertCallGraphEdges(db: ProjectDatabase, edges: CallGraphEdge[]): void {
  const statement = db.prepare(
    `INSERT INTO call_graph_edges (
        id, source_node_id, target_node_id, target_file_path, target_name, callee_text,
        confidence, resolution_kind, evidence_file_path, evidence_line, evidence_text
      ) VALUES (
        @id, @sourceNodeId, @targetNodeId, @targetFilePath, @targetName, @calleeText,
        @confidence, @resolutionKind, @evidenceFilePath, @evidenceLine, @evidenceText
      )`
  );

  for (const edge of edges) {
    statement.run({
      ...edge,
      targetNodeId: edge.targetNodeId ?? null,
      targetFilePath: edge.targetFilePath ?? null,
      targetName: edge.targetName ?? null,
    });
  }
}

export function listCallGraphNodes(db: ProjectDatabase): CallGraphNode[] {
  return db
    .prepare(
      `SELECT id, file_path AS filePath, kind, name, qualified_name AS qualifiedName,
              start_line AS startLine, end_line AS endLine
       FROM call_graph_nodes
       ORDER BY file_path, start_line`
    )
    .all() as CallGraphNode[];
}

export function listCallGraphEdgesBySourceNodeIds(db: ProjectDatabase, sourceNodeIds: string[]): CallGraphEdge[] {
  if (sourceNodeIds.length === 0) {
    return [];
  }

  const placeholders = sourceNodeIds.map(() => "?").join(", ");

  return db
    .prepare(
      `SELECT id, source_node_id AS sourceNodeId, target_node_id AS targetNodeId,
              target_file_path AS targetFilePath, target_name AS targetName, callee_text AS calleeText,
              confidence, resolution_kind AS resolutionKind, evidence_file_path AS evidenceFilePath,
              evidence_line AS evidenceLine, evidence_text AS evidenceText
       FROM call_graph_edges
       WHERE source_node_id IN (${placeholders})
       ORDER BY evidence_file_path, evidence_line`
    )
    .all(...sourceNodeIds) as CallGraphEdge[];
}
