# 1.0.0 (2026-02-05)


### Features

* Initial implementation of ConnectWise Automate TypeScript client ([2cfd4a3](https://github.com/asachs01/node-connectwise-automate/commit/2cfd4a37e109ece6f960a78d4d872c93831edc95))

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Security

- Enforce HTTPS on the user-supplied `serverUrl`; plain `http://` is now rejected
  unless the host is `localhost` or `127.0.0.1` (local development exception)
- Applied non-breaking `npm audit fix` updates to transitive dependencies

### Changed

- Standardized supported Node.js version on 22 across `package.json` engines,
  CI matrix (`22.x`, `24.x`), and the `tsup` build target (`node22`)
- Bumped `@types/node` to `^22.0.0`

### Added

- Initial release of the ConnectWise Automate TypeScript client library
- Support for both integrator and user authentication methods
- Full TypeScript type definitions for all API resources
- Resources: Computers, Clients, Locations, Contacts, Alerts, Scripts, Patches, Groups
- Automatic token management and refresh
- Rate limiting with configurable thresholds
- Automatic pagination support with async iterators
- Comprehensive error handling with typed exceptions
- Unit and integration tests using Vitest and MSW
- Semantic release for automated versioning
