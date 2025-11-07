# Synapse — Unified AI Command Console

## Overview
Synapse is a model-agnostic, locally anchored AI command console designed for total human control over memory and context. It allows seamless switching between models (local and cloud) while maintaining a consistent, local memory layer.

---

## Core Philosophy
- **Human-in-the-loop memory** — user manually selects injected memories  
- **Model agnostic** — use OpenAI, Anthropic, Groq, or local Ollama  
- **Sovereignty first** — privacy, local persistence, full user control  
- **Simplicity before autonomy** — clarity first, automation later  

---

## Stack
- Backend: FastAPI (Python)
- Frontend: React + Vite
- Vector DB: ChromaDB (simple) or Qdrant (for scale)
- Model layer: LiteLLM abstraction
- Storage: SQLite for metadata + raw text archives
- Local inference: Ollama integration

---

## Architecture Summary
### Memory Spine
- Vector + keyword hybrid search  
- Manual tagging (`#topic`, `#idea`)  
- SQLite metadata and text archive  
- Embedding cache for fast lookups

### Model Layer
- LiteLLM router for OpenAI, Anthropic, Groq, Ollama  
- Context window tracking  
- Model switching mid-session  

### Context Injection
- Semantic + keyword hybrid search  
- Manual checkbox selection  
- Real-time context token meter  
- Visual warnings at capacity  

---

## Current Goals (MVP)
1. Manual memory selection and injection  
2. Model selection + live token tracking  
3. Persistent local storage (SQLite + text files)  
4. Basic semantic search via Chroma  
5. Streaming chat responses  
6. Clean React UI (memory left / chat right)

---

## Near-Term Goals (v1.1-1.2)
- Tag filtering in memory panel  
- Auto-suggest memories (user-approved)  
- Conversation export/import  
- Memory editing and cleanup tools  
- LiteLLM multi-API cost tracking  
- Custom model presets  

---

## Mid-Term Goals (v1.5+)
- Memory summarization & consolidation  
- Duplicate/contradiction finder  
- Summarized context recommendations  
- Multi-turn context injection assistant  
- Optional memory graph visualization  

---

## Long-Term (v2+)
- Shared multi-user memory pools  
- Plugin architecture for personal tools  
- Mobile and desktop native wrappers  
- Fine-tuned models on user’s corpus  
- Autonomic “Synapse-Assist” mode (suggests, never overrides)

---

## File Layout
```
/synapse/
  /backend/
    main.py
    memory.py
    llm.py
    models.py
  /frontend/
    /src/components/
      MemoryPanel.jsx
      ChatPanel.jsx
      ModelSelector.jsx
  /data/
    /memories/{raw,manual}
    /vector_store/
    /conversations/
    synapse.db
  BUILD_SPEC.md
  BUILD_ORDER.md
```

---

## Design Principles
1. **Transparency > automation**  
2. **Speed > beauty**  
3. **Control > convenience**  
4. **Local > cloud**  
5. **Extensible > rigid**
