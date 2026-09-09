# @wyre-ai/node-connectwise-automate

Comprehensive, fully-typed Node.js/TypeScript library for the ConnectWise Automate REST API.

Every route and type is checked against ConnectWise's published OpenAPI spec for Automate (`/cwa/api/v1`, plus the handful of v2-only routes, which the client selects for you). Routes the spec does not define are not exposed.

## Installation

```bash
npm install @wyre-ai/node-connectwise-automate
```

## Authentication

ConnectWise Automate supports two authentication methods. Both need the `clientId` header ConnectWise issues for API integrations.

### Integrator Authentication (Recommended)

```typescript
import { ConnectWiseAutomateClient } from '@wyre-ai/node-connectwise-automate';

const client = new ConnectWiseAutomateClient({
  serverUrl: 'https://your-server.hostedrmm.com',
  clientId: process.env.CW_AUTOMATE_CLIENT_ID!,
  credentials: {
    method: 'integrator',
    integratorUsername: process.env.CW_AUTOMATE_USERNAME!,
    integratorPassword: process.env.CW_AUTOMATE_PASSWORD!,
  },
});
```

### User Authentication (with optional 2FA)

```typescript
const client = new ConnectWiseAutomateClient({
  serverUrl: 'https://your-server.hostedrmm.com',
  clientId: process.env.CW_AUTOMATE_CLIENT_ID!,
  credentials: {
    method: 'user',
    username: process.env.CW_AUTOMATE_USERNAME!,
    password: process.env.CW_AUTOMATE_PASSWORD!,
    twoFactorCode: '123456', // Required when the account has 2FA enabled
  },
});
```

When an account has 2FA enabled and no `twoFactorCode` is supplied, Automate answers the token request with `IsTwoFactorRequired` and no access token. The client throws `ConnectWiseAutomateAuthenticationError` in that case instead of sending an empty bearer token.

## Usage

Every `list()` returns a plain array: Automate serves list routes as bare JSON arrays with no total count. Filtering uses Automate's `condition` expression syntax. The shared list parameters are `condition`, `orderBy` (`'Field asc'` / `'Field desc'`), `page` (1-based), `pageSize` (max 1000), `includeFields`, `excludeFields`, `expand` and `ids`.

### Computers

```typescript
// Online computers for one client (folded into a `condition` for you)
const computers = await client.computers.list({ clientId: 100, isOnline: true });
console.log(`Found ${computers.length} computers`);

// Any Automate condition expression works too
const servers = await client.computers.list({
  condition: "OperatingSystemName like '%Server%'",
  orderBy: 'ComputerName asc',
});

// Get a specific computer
const computer = await client.computers.get(123);
console.log(computer.ComputerName, computer.Status, computer.OperatingSystemName);

// Iterate all computers with automatic pagination
for await (const computer of client.computers.listAll()) {
  console.log(computer.ComputerName);
}
```

### Commands

Automate commands are a fixed, server-defined catalog addressed by id, not free-text shell strings. Look the command up in the catalog, then issue it and wait for the agent to report back.

```typescript
// Discover what the instance offers; ids, names and parameters are server-defined
const catalog = await client.computers.commands();
console.table(catalog.map(({ Id, Name, Level }) => ({ Id, Name, Level })));

// Command 2 with a `cmd.exe!!! /c …` parameter is the shell-execute command the
// community AutomateAPI PowerShell module relies on
const result = await client.computers.executeCommandAndWait(
  123,
  { Command: { Id: '2' }, Parameters: ['cmd.exe!!! /c hostname'] },
  { timeoutMs: 60_000 }
);
console.log(result.completed, result.status, result.output);

// Fire and forget, then read the outcome later
const execution = await client.computers.executeCommand(123, {
  Command: { Id: '2' },
  Parameters: ['cmd.exe!!! /c hostname'],
});
const pending = await client.computers.commandExecutions(123, { ids: String(execution.Id) });
const history = await client.computers.commandHistory(123);
```

`executeCommandAndWait()` polls `GET /Computers/{id}/CommandExecute` for the execution id the launch returned and reads `Status` / `Output` from that row. A command that outlives `timeoutMs` comes back with `completed: false` and keeps running on the agent.

### Scripts

```typescript
// List scripts (filter with a condition; there are no dedicated name/folder params)
const scripts = await client.scripts.list({ condition: "Name like '%Cleanup%'" });

// Get a script (v1). getDetail() reads the v2 route, which also returns steps
// but is not served by every hosted instance.
const script = await client.scripts.get(456);
console.log(script.Id, script.Name);
const detail = await client.scripts.getDetail(456, { includeSteps: true });

// Run a script on several computers and wait for each to finish
const runs = await client.scripts.runAndWait(
  [123, 124, 125],
  {
    ScriptId: 456,
    Parameters: [{ Key: 'Param1', Value: 'value1' }],
    Priority: 2,
    OfflineActionFlags: { SkipsOfflineAgents: true },
  },
  { timeoutMs: 120_000 }
);
for (const run of runs) {
  console.log(run.computerId, run.launched, run.completed, run.state, run.diagnosticMessage);
}

// Launch without waiting, then read results from script history
const batch = await client.scripts.executeBatch({ ScriptId: 456, EntityIds: [123] });
const history = await client.scripts.historyForComputer(123, {
  orderBy: 'HistoryDate desc',
  pageSize: 20,
});
const running = await client.scripts.runningOnComputer(123);
```

Automate has no synchronous "run script" call and returns no job handle. `runAndWait()` launches through `POST /Batch/ScriptExecute`, then polls each computer's script history for a new `Completed` row for that script. A target that outlives `timeoutMs` comes back with `completed: false` while the script keeps running server-side; pick it up later with `historyForComputer()`.

### Clients and locations

```typescript
const clients = await client.clients.list({ condition: "Name like '%Acme%'" });

const newClient = await client.clients.create({
  Name: 'Acme Corporation',
  Company: 'Acme Corporation',
  City: 'New York',
  State: 'NY',
  ZipCode: '10001',
});

// PATCH routes take JSON Patch operations; update() builds them from a partial
await client.clients.update(100, { PhoneNumber: '555-123-4567' });

// Locations belong to a client
const locations = await client.locations.list({ clientId: 100 });
const branch = await client.locations.create({ Name: 'Branch Office', Client: { Id: 100 } });
```

### Contacts

Contacts are served by the v2 API. There is no PATCH route, so `update()` sends the full record with PUT.

```typescript
const contacts = await client.contacts.list({ condition: "EmailAddress like '%@acme.com'" });

const contact = await client.contacts.create({
  FirstName: 'Jane',
  LastName: 'Doe',
  EmailAddress: 'jane@acme.com',
  Client: { ClientId: 100 },
});

await client.contacts.update(contact.ContactId, {
  FirstName: 'Jane',
  LastName: 'Doe',
  EmailAddress: 'jane.doe@acme.com',
  Client: { ClientId: 100 },
});
```

### Alerts

The API exposes alerts read-only; there are no acknowledge or close routes.

```typescript
const alerts = await client.alerts.list({
  condition: "Severity.Name = 'Critical'",
  orderBy: 'AlertDate desc',
});
const alert = await client.alerts.get(alerts[0].AlertId);
console.log(alert.Message, alert.Severity?.Name, alert.Computer?.Name);

const forComputer = await client.alerts.listForComputer(123);
```

### Patches

```typescript
const stats = await client.patches.patchingStats(123);
console.log(stats.OverallCompliance, stats.MissingPatchCount, stats.FailedPatchCount);

const microsoft = await client.patches.microsoftUpdates(123);
const thirdParty = await client.patches.thirdPartyPatches(123);

const history = await client.patches.history({
  condition: 'ComputerId = 123',
  orderBy: 'ActionDate desc',
});

// Patch actions target an entity by Automate's numeric entity-type ordinal
// (the spec does not enumerate the values) and the entity's id.
await client.patches.deployAllApproved({ EntityType: computerEntityType, EntityId: 123 });
```

Available actions: `deployAllApproved`, `deployAllSecurity`, `reattemptFailed`, `setToTestStage`, `setToPilotStage`, `setToProductionStage`.

### Groups

```typescript
const groups = await client.groups.list({ condition: "FullName like 'Service Plans%'" });
const group = await client.groups.get(groupId);

// Membership lives on /GroupComputers
const members = await client.groups.computers(groupId);
const membership = await client.groups.addComputer(groupId, 123);
await client.groups.removeComputer(membership.Id);
```

## Rate Limiting and Retries

The client includes built-in rate limiting with configurable thresholds:

```typescript
const client = new ConnectWiseAutomateClient({
  serverUrl: 'https://your-server.hostedrmm.com',
  clientId: 'your-client-id',
  credentials: {
    method: 'integrator',
    integratorUsername: 'username',
    integratorPassword: 'password',
  },
  rateLimit: {
    enabled: true,
    maxRequests: 100,      // Maximum requests per window
    windowMs: 60000,       // Window duration (1 minute)
    throttleThreshold: 0.8, // Start throttling at 80% capacity
    retryAfterMs: 5000,    // Default retry delay
    maxRetries: 3,         // Maximum retries on rate limit
  },
});

// Check rate limit status
const status = client.getRateLimitStatus();
console.log(`${status.remaining} requests remaining`);
```

A 429 is retried for any method, since the server did not process the request. A 5xx or a transport failure (connection reset mid-transfer) is retried once, and only for GET, PUT and DELETE; POST is never re-sent automatically, so a script or command launch cannot fire twice. An expired token is refreshed and the request replayed once on 401.

## Error Handling

The library provides typed error classes for different error scenarios:

```typescript
import {
  ConnectWiseAutomateError,
  ConnectWiseAutomateAuthenticationError,
  ConnectWiseAutomateForbiddenError,
  ConnectWiseAutomateNotFoundError,
  ConnectWiseAutomateValidationError,
  ConnectWiseAutomateRateLimitError,
  ConnectWiseAutomateServerError,
} from '@wyre-ai/node-connectwise-automate';

try {
  const computer = await client.computers.get(999);
} catch (error) {
  if (error instanceof ConnectWiseAutomateNotFoundError) {
    console.log('Computer not found');
  } else if (error instanceof ConnectWiseAutomateValidationError) {
    // 400 from the server, e.g. a malformed `condition`
    console.log('Validation errors:', error.errors);
  } else if (error instanceof ConnectWiseAutomateRateLimitError) {
    console.log(`Rate limited, retry after ${error.retryAfter}ms`);
  }
}
```

## TypeScript Support

All API responses are typed from the spec's own schemas:

```typescript
import type {
  Computer,
  Client,
  Location,
  Contact,
  Alert,
  Script,
  ScriptDetail,
  PatchHistory,
  Group,
} from '@wyre-ai/node-connectwise-automate';

const computer: Computer = await client.computers.get(123);
console.log(computer.ComputerName);
console.log(computer.OperatingSystemName, computer.OperatingSystemVersion);
console.log(computer.Status, computer.RemoteAgentLastContact);
console.log(computer.Client?.Name, computer.Location?.Name);
```

## License

Apache-2.0
