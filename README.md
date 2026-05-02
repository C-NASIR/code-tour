# code-tour

`code-tour` is a local TypeScript CLI for building a structural map of a JavaScript or TypeScript codebase.

Phase 1 is intentionally narrow:

```text
What exists in this Node codebase?
```

The tool is framework agnostic at the core and ships with Express as the first framework plugin.

## Phase 1 scope

Phase 1 supports:

- JavaScript files
- TypeScript files
- CommonJS imports where feasible
- ES module imports
- exports
- functions
- classes
- methods where easy
- basic function calls
- Express routes
- Express middleware

Phase 1 does not support:

- React component understanding
- JSX analysis
- frontend event flow
- browser behavior
- full runtime behavior
- deep call graph tracing
- embeddings
- a web UI
- automatic code editing

## Architecture

The system has two layers:

- Core analyzer:
  - scans JS/TS files
  - extracts imports, exports, functions, classes, methods, and simple function calls
  - stores normalized records in SQLite
- Framework plugins:
  - add framework-specific extraction without changing the generic symbol model
  - Express is the first plugin and extracts routes and middleware

## Current commands

- `code-tour index <projectPath>`
- `code-tour files`
- `code-tour symbols`
- `code-tour imports <filePath>`
- `code-tour routes`
- `code-tour middleware`
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
- `router.post("/", createUser)`
- imports between routes, controllers, services, and repo files

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
- middleware
- function calls
- summaries

## Notes

- Indexing is a full refresh, not incremental.
- Malformed files are skipped rather than aborting the whole run.
- Express support is implemented as plugin-style framework logic under `src/frameworks/express`.
