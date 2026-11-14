# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Data issue template with cell/year/month fields, to trace numbers back to the pipeline.
- `scripts/validate_data.py`: contract checks for processed files, calibration and the mock.

### Changed

- Playbook, roadmap and submission checklist rewritten around the NASA Space Apps challenge.

## [0.1.0] - 2026-11-14

### Added

- Repository scaffold for the NASA Space Apps 2026 challenge *Harmonization of MODIS and
  VIIRS Hot Spots*.
- Data contract, JSON Schemas, calibration record shape and a three-row mock fixture.
- Next.js static app shell with the project story, the data contract and a design preview of
  the calendar.
- Methodology, data dictionary, limitations, architecture, FAQ and pitch documents.
- CI (repo checks + static build), issue/PR templates and dependency automation.
- Community documents: contributing guide, code of conduct, security policy, support,
  governance, MIT license.

[Unreleased]: ../../compare/0.1.0...HEAD
[0.1.0]: ../../releases/tag/0.1.0
