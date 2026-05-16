# Documentation Guide

This directory is organized by **audience** and **purpose** so operational guides, design notes, sourcing material, and historical archives do not all compete at the same level.

## How To Use This Set

Use the docs in this order when you are getting oriented:

- Start with [developer.md](developer.md) for day-to-day repo workflow, commands, and contribution expectations.
- Use [operations/repo-sync-playbook.md](operations/repo-sync-playbook.md) for the authoritative app/data boundary rules and no-loss sync procedure.
- Use [operations/mission-data-current-state.md](operations/mission-data-current-state.md) for the current live boundary state and recent mission-data extraction status.
- Use [design/design.md](design/design.md) for runtime architecture, product-surface structure, and deeper design notes.
- Use [design/architecture/target-architecture.md](design/architecture/target-architecture.md) when you need the canonical runtime-architecture record; older refactor plans under [archived/](archived/) are historical only.

## Start Here

- Contributor workflow and repo conventions: [developer.md](developer.md)
- System architecture and design map: [design/design.md](design/design.md)

## Current Workstreams

Use these for active planning and cross-document context:

- Current plan and parking lot: [operations/current-plan.md](operations/current-plan.md)
- Artemis II media, streams, transcripts, attribution, and launch work: [operations/artemis2-media-workstream.md](operations/artemis2-media-workstream.md)
- Performance and responsiveness optimization queue: [operations/performance-workstream.md](operations/performance-workstream.md)
- Timekeeping, UTC/TDB, mission-clock, stream, and transcript synchronization: [design/architecture/time-synchronization-and-timekeeping.md](design/architecture/time-synchronization-and-timekeeping.md)

## Guides

How to work in the repo day to day:

- AI/tooling notes: [guides/ai-tools.md](guides/ai-tools.md)
- Testing strategy and commands: [guides/testing.md](guides/testing.md)

## Operations

Runtime/data boundary, staging, deployment, and asset-process guidance:

- Current plan and active workstreams: [operations/current-plan.md](operations/current-plan.md)
- Repo boundary and sync workflow: [operations/repo-sync-playbook.md](operations/repo-sync-playbook.md)
- Current mission-data operating model: [operations/mission-data-current-state.md](operations/mission-data-current-state.md)
- Public R2 asset serving contract: [operations/r2-asset-hosting.md](operations/r2-asset-hosting.md)
- Moon render asset provenance and maintenance: [operations/moon-render-assets.md](operations/moon-render-assets.md)
- Artemis II media active workstream: [operations/artemis2-media-workstream.md](operations/artemis2-media-workstream.md)
- Artemis II media asset source and maintenance notes: [operations/artemis2-media-assets.md](operations/artemis2-media-assets.md)
- Performance active workstream: [operations/performance-workstream.md](operations/performance-workstream.md)
- Lunar feature datasets and Artemis II map reference links: [operations/lunar-feature-and-artemis2-reference-sources.md](operations/lunar-feature-and-artemis2-reference-sources.md)

## Product Specs

User-facing or workflow-facing feature specifications:

- Mobile experience v1: [specs/mobile-experience-v1-spec.md](specs/mobile-experience-v1-spec.md)

## Design

Design documents stay under [design/](design/), grouped further by purpose:

- Architecture and runtime model notes: [design/architecture/](design/architecture/)
- Feature and behavior specs: [design/specs/](design/specs/)
- Roadmaps, plans, and backlog notes: [design/roadmap/](design/roadmap/)
- Research and experiments: [design/research/](design/research/)
- Reference material: [design/references/](design/references/)

The design hub remains [design/design.md](design/design.md).

Key architecture entry points:

- Runtime architecture record: [design/architecture/target-architecture.md](design/architecture/target-architecture.md)
- Time synchronization and timekeeping: [design/architecture/time-synchronization-and-timekeeping.md](design/architecture/time-synchronization-and-timekeeping.md)

## Mission Sourcing

Mission onboarding, HORIZONS sourcing, and source corpora:

- Worker playbook: [mission-sourcing/horizons-worker-playbook.md](mission-sourcing/horizons-worker-playbook.md)
- Mission coverage inventory: [mission-sourcing/horizons-lunar-missions.md](mission-sourcing/horizons-lunar-missions.md)
- HORIZONS blurbs corpus: [horizons-blurbs/](horizons-blurbs/)

## Investigations

Focused issue investigations and one-off technical deep dives:

- [investigations/](investigations/)

## Archived

Historical proposals and superseded planning material:

- [archived/](archived/)

Most refactor-era plans and architecture proposals now live only here. Keep them for context, but prefer the active docs above for current guidance.
