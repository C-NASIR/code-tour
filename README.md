# code-tour

`code-tour` is a local TypeScript CLI for building a structural map of a JavaScript or TypeScript codebase.

Phase 2 adds deterministic request-flow tracing on top of the Phase 1 structural index:

```text
What route handles this request pattern, and what project-local code does it call next?
```

The tool is framework agnostic at the core and ships with Express as the first framework plugin.

## Phase 2 scope

Phase 2 supports:

- JavaScript files
- TypeScript files
- CommonJS imports where feasible
- ES module imports
- exports
- functions
- classes
- methods where easy
- basic function calls
- Express routes with ordered handler chains
- Express mount resolution for `app.use("/prefix", router)`
- call graph extraction for local project code
- bounded route tracing
- optional AI explanation of a deterministic trace

Phase 2 does not support:

- React component understanding
- JSX analysis
- frontend event flow
- browser behavior
- full runtime behavior
- concrete URL matching such as `/users/123` against `/users/:id`
- unbounded interprocedural tracing
- embeddings
- a web UI
- automatic code editing

## Architecture

The system has two layers:

- Core analyzer:
  - scans JS/TS files
  - extracts imports, exports, functions, classes, methods, object-literal methods, and simple function calls
  - stores normalized records in SQLite
- Framework plugins:
  - add framework-specific extraction without changing the generic symbol model
  - Express is the first plugin and extracts routes, middleware, mounts, and full mounted paths
- Flow layer:
  - resolves route handlers and local call targets conservatively
  - traces from mounted route patterns into controller, service, and repository calls
  - surfaces unresolved and external calls instead of guessing

## Current commands

- `code-tour index <projectPath>`
- `code-tour files`
- `code-tour symbols`
- `code-tour imports <filePath>`
- `code-tour routes`
- `code-tour middleware`
- `code-tour trace <METHOD> <PATH>`
- `code-tour explain <filePath>`

## Install

```bash
npm install
```

## Development

Run from source:

```bash
npm run dev -- --help
```

Build:

```bash
npm run build
```

Test:

```bash
npm test
```

## Environment

The `index` command generates one structured summary per file and requires:

```bash
export OPENAI_API_KEY=your_key_here
export OPENAI_MODEL=gpt-4.1-mini
```

Read-only commands work without OpenAI credentials after a project has already been indexed.

## Usage

Index the shipped Express example:

```bash
npm run dev -- index examples/express-basic
```

List indexed files:

```bash
npm run dev -- files --project examples/express-basic
```

List generic symbols:

```bash
npm run dev -- symbols --project examples/express-basic
```

List Express routes:

```bash
npm run dev -- routes --project examples/express-basic
```

Trace a normalized mounted route pattern:

```bash
npm run dev -- trace GET /users/:id --project examples/express-basic
```

Trace and request an AI explanation based only on the stored trace evidence:

```bash
npm run dev -- trace POST /users --project examples/express-basic --explain
```

List Express middleware:

```bash
npm run dev -- middleware --project examples/express-basic
```

Inspect imports for a file:

```bash
npm run dev -- imports src/routes/users.ts --project examples/express-basic
```

Explain one indexed file:

```bash
npm run dev -- explain src/routes/users.ts --project examples/express-basic
```

## Example project

The repository includes an Express example in [examples/express-basic](/Users/cnasir/learn/ai-native/code_guide/examples/express-basic).

The analyzer should detect:

- `app.use("/users", usersRouter)`
- `router.get("/", listUsers)`
- `router.get("/:id", getUserById)`
- `router.post("/", validateUser, createUser)`
- imports between routes, controllers, services, and repo files
- controller -> service -> repository flow edges

## Storage

Each indexed project stores its snapshot at:

```text
<project>/.code-tour/index.sqlite
```

The index stores:

- files
- imports
- exports
- symbols
- routes
- route handlers
- express mounts
- middleware
- function calls
- call graph nodes
- call graph edges
- summaries

## Notes

- Indexing is a full refresh, not incremental.
- Malformed files are skipped rather than aborting the whole run.
- Express support is implemented as plugin-style framework logic under `src/frameworks/express`.
- Canonical indexed route paths use no trailing slash except for `/`.
- `trace` matches normalized stored route patterns exactly, so use `/users/:id` rather than `/users/123`.
- `--explain` reuses `OPENAI_API_KEY` and `OPENAI_MODEL`; deterministic trace output is still shown if explanation fails.
