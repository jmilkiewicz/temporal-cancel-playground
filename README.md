# temporal-cancellation-playground

Experiments with cancellation in the Temporal TypeScript SDK (`@temporalio/*` **1.24.0**, pinned).
It shows what happens to a workflow and its activities when the workflow itself is cancelled,
depending on the activity cancellation type, whether the activity heartbeats, and whether the
workflow catches the cancellation.

- `src/workflows2.ts`: workflows used by `cancelWorkflow.test.ts`
- `src/activities.ts`: activities (`slow`, `heartbeatingHonouringCancel`,
  `heartbeatingWithIgnoringCancelSignal`, `cleanup`)
- `src/activityOptions.ts`: per-activity options shared by workflows and tests
- `src/probe.ts`: in-process probe the activities use to report back to the tests
- `src/cancelWorkflow.test.ts`: cancels the workflow with `handle.cancel()`
- `src/workflows.ts` and `src/cancelProbe.test.ts`: earlier variant that cancels an inner scope via a signal

Requires Node.js >= 20.3.

```sh
npm install
```

## Tests

```sh
npm test
```

The tests use `TestWorkflowEnvironment.createLocal()` from `@temporalio/testing`, which starts a
local Temporal dev server. They need no Docker. On the first run the SDK downloads the dev server
binary, so that first run needs network access. The heartbeating activities call a slow endpoint on a
local HTTP server (`src/workServer.ts`) started by the tests, so nothing else needs the network.

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
