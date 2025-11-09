# Changelog

## [v0.6.6] – 2025-11-08
### Added
- Dynamic model configuration UI with cost-tier visualization.
- Persistent model preferences with localStorage sync.
- Multi-provider model discovery (OpenAI + Ollama) with live status check.
- README and LICENSE files for open release.
- Improved .gitignore coverage (env, venvs, build outputs, secrets).

### Fixed
- Cost-tier CSS classes and UI grid alignment.
- Build warnings in Vite and Python compile step.

### Known Limitations
- Provider-specific parameter modifiers and Anthropic/XAI integrations are planned for Phase 7.
- Ollama offline handling is stable but pending advanced retry logic.
