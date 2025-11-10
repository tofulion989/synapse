# Changelog

## [v0.7.1] - 2025-11-09
### Fixed
- Removed duplicate `build_context` and `_cloud_models_for` definitions in `llm.py`.
- Corrected imports for `MemoryStore` in `main.py`.
- Hardened cosine similarity helpers to avoid division-by-zero.
- Ensure summary generation uses `settings.summary_model` for flexibility.

### Improved
- Code consistency and runtime safety across backend modules.
- Prepared backend surface for Phase 4 UI upgrades and LAN deployment.

## [v0.7.0] - 2025-11-10
### Added
- Restored `_cloud_models_for` in `LLMRouter` to fix `/api/models` endpoint.
- Improved sidebar collapse/scroll handling for smaller screens.
- Backend modular refactor prep (vector/embedding ready).
- Updated Tailwind theming and frontend consistency.

### Fixed
- `/api/models` 500 errors due to missing router method.
- Sidebar overflow and scroll independence.

### Notes
- v0.6.6 remains stable baseline.

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
