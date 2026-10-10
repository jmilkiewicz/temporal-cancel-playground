# temporal-playground

Minimal "hello world" using the Temporal TypeScript SDK (`@temporalio/*` **1.24.0**, pinned).

- `src/activities.ts`: the `greet(name)` activity
- `src/greetWorkflow.ts`: the `greetWorkflow(name)` workflow, which calls `greet`
- `src/worker.ts`: a worker that registers the workflow and the activity
- `src/client.ts`: a CLI client that starts the workflow
- `src/greetWorkflow.test.ts`: end-to-end tests on `TestWorkflowEnvironment.createTimeSkipping()`

Requires Node.js >= 20.3.

```sh
npm install
```

## Tests (no Docker)

```sh
npm test
```

The tests use `TestWorkflowEnvironment.createTimeSkipping()` from `@temporalio/testing`. They need
neither Docker nor an external Temporal server. On the first run the SDK downloads the Time
Skipping Test Server binary and caches it in `$TMPDIR`, so that first run needs network access.

On Apple Silicon the SDK downloads a native arm64 binary, so Rosetta is not needed. The comment
in the SDK typings that says otherwise is outdated.

Shared test helpers belong in `src/test-utils/`. Like `*.test.ts` files, that directory is
excluded from the build (`tsconfig.build.json`).

### Why Jest rather than Vitest

Jest (+ `ts-jest`) is the only one of the two that the
[Temporal docs](https://docs.temporal.io/develop/typescript/testing-suite) officially support. They
list its requirements (Jest >= 27, `testEnvironment: "node"`) and base their `beforeAll` and
`afterAll` examples on it. Vitest is not mentioned in the docs. It would probably work, but nothing
on the SDK side guarantees it.

Note: `ts-jest` 29.4 requires TypeScript `<7`, which is why TypeScript is pinned to 6.0.3.

## Formatting

Code is formatted with Prettier (pinned in `devDependencies`, config in `.prettierrc.json`).

```sh
npm run format        # rewrite files in place
npm run format:check  # fail if anything is not formatted
```

## Running manually against a server (docker-compose)

This is a separate path. `npm test` does not use it. The worker and client run straight from
TypeScript via `tsx`; `npm run build` (tsc to `lib/`) is only needed for a compiled build.

```sh
npm run server:up              # docker compose up -d: Temporal server + Web UI
npm run start:worker           # terminal 1
npm run start:client -- Alice  # terminal 2, prints "Hello, Alice!"
npm run server:down
```

Web UI: <http://localhost:8080>. You will find the started `greet-<uuid>` workflow in the `default`
namespace. The gRPC server listens on `localhost:7233`. Set `TEMPORAL_ADDRESS` to use a different
address.
