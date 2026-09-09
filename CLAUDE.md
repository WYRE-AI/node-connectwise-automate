# node-connectwise-automate

TypeScript client for the ConnectWise Automate REST API. Ground truth for routes and
schemas is ConnectWise's published swagger, mirrored per controller in
`covenanttechnologysolutions/connectwise-rest` under `generator/automate-json/`.
Corroborate wire behaviour with `HealthITAU/pyconnectwise` and `gavsto/AutomateAPI`
(PowerShell); both are exercised against real instances.

## Working here

- `npm test` (vitest + msw), `npm run typecheck`, `npm run lint`, `npm run build` (tsup).
- Releases are PR-based semantic-release: `scripts/prepare-release.mjs` writes
  `CHANGELOG.md` from commit messages. Do not hand-edit the changelog; put the notes in
  the commit body (`fix!:` + `BREAKING CHANGE:` footer for majors).
- A route that is not in the spec does not get a method. Check `paths` before adding one.

## Learnings - 2026-09-08

Full audit of every resource against the spec (PR #88). What Automate actually does:

- List routes return a bare JSON array. There is no `{ Data, TotalRecords }` envelope and
  no total count; the last page is a short page. #78 had normalized *into* the envelope,
  which was the wrong direction.
- Query parameters are flat: `page`, `pageSize`, `condition`, `orderBy` (`'Field desc'`),
  `includeFields`, `excludeFields`, `expand`, `ids`. The swagger shows
  `options.includedFields` / `options.expands` — those are C# property names; no working
  client sends them. An unknown query param is silently ignored and the route returns
  everything, so filters such as client, location, online state, name or folder must be
  expressed as a `condition` (`Client.Id = 1`, `Status = 'Online'`, `Name like '%x%'`).
- `/Computers` has no create/update/delete, and there are no Restart, Shutdown, WakeUp or
  SendMessage routes. Those are catalog commands: `POST /Computers/{id}/CommandExecute`
  with `{ Command: { Id }, Parameters: string[] }`, then poll
  `GET /Computers/{id}/CommandExecute?ids=<Id>` and read `Status` / `Output` from that
  row (`Success`, `Failed`, `Terminated` are terminal). Catalog ids are instance-defined;
  the PowerShell module uses id 2 with a `cmd.exe!!! /c …` parameter for shell execution.
- Scripts run through `POST /Batch/ScriptExecute` (`Parameters` as `{Key, Value}`,
  `OfflineActionFlags`, per-target `ResultDetails`). No job handle exists anywhere in the
  spec; outcomes are recovered from `GET /Computers/{id}/ScriptHistory`
  (`Status = Completed`, `State = Success | Failure | Information`). `GET /Scripts/{id}`
  is v2-only and `Script.Id` is a string.
- Contacts CRUD exists only under `/api/v2` (`ContactId`, `EmailAddress`,
  `Client { ClientId }`), with PUT rather than PATCH. PATCH bodies everywhere are
  JSON Patch operations `[{ Op, Path, Value }]`, not partial entities.
- No `/Patches*` routes exist. Patching is `/PatchHistory`,
  `/Computers/{id}/MicrosoftUpdates | ThirdPartyPatches | PatchingStats` and
  `POST /PatchActions/{Action}`. Alerts are read-only (no acknowledge/close).
- A 400 is a malformed request (usually the `condition`), not an auth failure. The token
  route answers a 2FA-enabled account with `IsTwoFactorRequired` and no `AccessToken`.
- Still unverified against a live instance: `GET /Computers/{id}` (spec omits it,
  pyconnectwise models it), the `GroupComputer.Id` format, and the numeric
  `PatchActionArgs.EntityType` ordinals.

## Learnings - 2026-09-09

- A spec omission is not proof a route is missing. The v1 swagger has no
  `GET /Scripts/{id}`, yet live instances serve it, and moving `scripts.get()` to the
  v2 route broke a customer whose hosted instance terminates v2 requests
  (`TypeError: terminated`). When a route demonstrably worked in production, keep it;
  `get()` is v1 and `getDetail()` is the v2 contract.
