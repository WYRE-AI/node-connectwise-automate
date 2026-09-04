## [2.0.4](https://github.com/WYRE-AI/node-connectwise-automate/compare/v2.0.3...v2.0.4) (2026-09-04)


### Bug Fixes

* **release:** use inline http.extraheader instead of git remote set-url ([#84](https://github.com/WYRE-AI/node-connectwise-automate/issues/84)) ([aa5c4e4](https://github.com/WYRE-AI/node-connectwise-automate/commit/aa5c4e43f3cf0a1180b10b9764aa1268e10e2998))
* **security:** resolve dependabot alerts via npm audit fix ([#81](https://github.com/WYRE-AI/node-connectwise-automate/issues/81)) ([b50a7c9](https://github.com/WYRE-AI/node-connectwise-automate/commit/b50a7c90748c0bf045195bbb1f7f8752f9b7da8e))


## [2.0.3](https://github.com/WYRE-AI/node-connectwise-automate/compare/v2.0.2...v2.0.3) (2026-08-28)


### Bug Fixes

* normalize bare-array list responses into { Data, TotalRecords } ([#78](https://github.com/WYRE-AI/node-connectwise-automate/issues/78)) ([c739317](https://github.com/WYRE-AI/node-connectwise-automate/commit/c73931741be29e517dac6536140ef13621108897)), closes [#38](https://github.com/WYRE-AI/node-connectwise-automate/issues/38)

## [2.0.2](https://github.com/WYRE-AI/node-connectwise-automate/compare/v2.0.1...v2.0.2) (2026-08-26)


### Bug Fixes

* **ci:** stop daily-failing Dependabot security jobs for esbuild/undici ([#73](https://github.com/WYRE-AI/node-connectwise-automate/issues/73)) ([4e93542](https://github.com/WYRE-AI/node-connectwise-automate/commit/4e935422429a3d69e0f3c60038f65b98a910ab0a))

## [2.0.1](https://github.com/WYRE-AI/node-connectwise-automate/compare/v2.0.0...v2.0.1) (2026-08-25)


### Bug Fixes

* migrate to WYRE-AI org (npm scope, ghcr namespace, registry) ([#76](https://github.com/WYRE-AI/node-connectwise-automate/issues/76)) ([413dd3d](https://github.com/WYRE-AI/node-connectwise-automate/commit/413dd3d753b0ec6a4e1d02fa4f0c5cfda5bf23a7))

# [2.0.0](https://github.com/wyre-technology/node-connectwise-automate/compare/v1.0.5...v2.0.0) (2026-08-14)


* fix!: replace fabricated script/command routes with the real Automate API ([#72](https://github.com/wyre-technology/node-connectwise-automate/issues/72)) ([d6134df](https://github.com/wyre-technology/node-connectwise-automate/commit/d6134df0af7743206c8034e4d15b0b05cf8409a3))


### BREAKING CHANGES

* ScriptsResource.execute, executions, executionsAll and
getExecution are removed; Automate has no such endpoints. Use executeBatch or
runAndWait, and read results via historyForComputer. runAndWait takes a
computer-id array and returns one result per computer.
ComputersResource.executeCommand now takes { Command: { Id }, Parameters?:
string[] } and returns ComputerCommandExecution instead of CommandResult.
BaseListParams.select is renamed to includeFields.

## [1.0.5](https://github.com/wyre-technology/node-connectwise-automate/compare/v1.0.4...v1.0.5) (2026-08-06)


### Bug Fixes

* **deps:** ignore unreachable ip-address advisory in dependabot config ([#67](https://github.com/wyre-technology/node-connectwise-automate/issues/67)) ([ce2365e](https://github.com/wyre-technology/node-connectwise-automate/commit/ce2365e0a599847d2535fe2f4cf07537e91f41a0))

## [1.0.4](https://github.com/wyre-technology/node-connectwise-automate/compare/v1.0.3...v1.0.4) (2026-07-18)


### Bug Fixes

* read HTTP response bodies exactly once ([#54](https://github.com/wyre-technology/node-connectwise-automate/issues/54)) ([2fc9bc2](https://github.com/wyre-technology/node-connectwise-automate/commit/2fc9bc2703d1d5f5bf92e616db360f7a633ec42b))

## [1.0.3](https://github.com/wyre-technology/node-connectwise-automate/compare/v1.0.2...v1.0.3) (2026-06-08)


### Bug Fixes

* **security:** bump vitest + @vitest/coverage-v8 1.x -> 3.2.6 ([#27](https://github.com/wyre-technology/node-connectwise-automate/issues/27)) ([a9fcd07](https://github.com/wyre-technology/node-connectwise-automate/commit/a9fcd07db6e3b52424c96a08b1151d6904ca73b5))

## [1.0.2](https://github.com/wyre-technology/node-connectwise-automate/compare/v1.0.1...v1.0.2) (2026-05-20)


### Bug Fixes

* medium-severity review fixes (HTTPS validation, Node 22, audit) ([#2](https://github.com/wyre-technology/node-connectwise-automate/issues/2)) ([d855460](https://github.com/wyre-technology/node-connectwise-automate/commit/d85546049862c4587d3efd4c2a80e13ca2581841))

## [1.0.1](https://github.com/wyre-technology/node-connectwise-automate/compare/v1.0.0...v1.0.1) (2026-02-18)


### Bug Fixes

* require Node 22+ (semantic-release@25 compatibility) ([bf8a83c](https://github.com/wyre-technology/node-connectwise-automate/commit/bf8a83c5d886498bf4a5c3e885a51352b8773ed6))
* require Node 22+ (semantic-release@25 compatibility) ([515a216](https://github.com/wyre-technology/node-connectwise-automate/commit/515a216d131b7ab5d33063531c289b2fd8f24c27))
* trigger initial npm package publish ([228f8c1](https://github.com/wyre-technology/node-connectwise-automate/commit/228f8c120668e310b6841a94c75a2669b199c22e))

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
