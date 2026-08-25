# @wyre-ai/node-connectwise-automate

Comprehensive, fully-typed Node.js/TypeScript library for the ConnectWise Automate API.

## Installation

```bash
npm install @wyre-ai/node-connectwise-automate
```

## Authentication

ConnectWise Automate supports two authentication methods:

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
    twoFactorCode: '123456', // Optional
  },
});
```

## Usage

### Computers

```typescript
// List all computers
const computers = await client.computers.list();
console.log(`Found ${computers.TotalRecords} computers`);

// Get a specific computer
const computer = await client.computers.get(123);
console.log(`Computer: ${computer.ComputerName}`);

// Iterate all computers with automatic pagination
for await (const computer of client.computers.listAll()) {
  console.log(computer.ComputerName);
}

// Execute a command on a computer
const result = await client.computers.executeCommand(123, {
  Command: 'ipconfig /all',
  RunAsAdmin: true,
});
console.log(result.Output);

// Restart a computer
await client.computers.restart(123, false, 5); // Not forced, 5 minute delay
```

### Clients

```typescript
// List all clients
const clients = await client.clients.list();

// Create a new client
const newClient = await client.clients.create({
  Name: 'Acme Corporation',
  Address1: '123 Main Street',
  City: 'New York',
  State: 'NY',
  ZipCode: '10001',
});

// Update a client
await client.clients.update(100, {
  Phone: '555-123-4567',
});
```

### Locations

```typescript
// List locations for a client
const locations = await client.locations.list({ clientId: 100 });

// Create a new location
const newLocation = await client.locations.create({
  Name: 'Branch Office',
  ClientId: 100,
  Address1: '456 Oak Avenue',
  City: 'Brooklyn',
  State: 'NY',
});
```

### Alerts

```typescript
// List alerts
const alerts = await client.alerts.list({
  status: 'New',
  severity: 4,
});

// Acknowledge alerts
await client.alerts.acknowledge({
  AlertIds: [1, 2, 3],
  Notes: 'Acknowledged via API',
});

// Close alerts
await client.alerts.close({
  AlertIds: [1, 2, 3],
  Notes: 'Resolved',
});

// Get alert statistics
const stats = await client.alerts.statistics();
console.log(`${stats.New} new alerts, ${stats.Acknowledged} acknowledged`);
```

### Scripts

```typescript
// List available scripts
const scripts = await client.scripts.list();

// Execute a script on multiple computers
const execution = await client.scripts.execute({
  ScriptId: 456,
  ComputerIds: [123, 124, 125],
  Parameters: {
    Param1: 'value1',
  },
  Priority: 2, // Normal priority
});
console.log(`Job ID: ${execution.JobId}`);

// Check execution history
const history = await client.scripts.executions({
  scriptId: 456,
  status: 'Completed',
});
```

### Patches

```typescript
// List patches
const patches = await client.patches.list({
  isApproved: false,
  severity: 'Critical',
});

// Approve patches
await client.patches.approve({
  PatchIds: [1, 2, 3],
  Notes: 'Approved for deployment',
});

// Install patches on computers
await client.patches.install({
  ComputerIds: [123, 124],
  PatchIds: [1, 2, 3],
  ForceReboot: false,
  RebootDelayMinutes: 30,
});

// Get patch statistics
const stats = await client.patches.statistics();
console.log(`${stats.ApprovedPatches} patches approved`);
```

### Groups

```typescript
// List groups
const groups = await client.groups.list({
  groupType: 'ComputerGroup',
});

// Get group members
const members = await client.groups.members(groupId);

// Add computers to a group
await client.groups.addMembers(groupId, {
  MemberIds: [123, 124, 125],
});
```

## Rate Limiting

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
    console.log('Validation errors:', error.errors);
  } else if (error instanceof ConnectWiseAutomateRateLimitError) {
    console.log(`Rate limited, retry after ${error.retryAfter}ms`);
  }
}
```

## TypeScript Support

All API responses are fully typed:

```typescript
import type {
  Computer,
  Client,
  Location,
  Contact,
  Alert,
  Script,
  Patch,
  Group,
} from '@wyre-ai/node-connectwise-automate';

const computer: Computer = await client.computers.get(123);
// TypeScript knows all available properties
console.log(computer.ComputerName);
console.log(computer.OS);
console.log(computer.IsOnline);
```

## License

Apache-2.0
