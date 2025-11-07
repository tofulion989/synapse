# Synapse Build Order (For Codex or Manual Execution)

## Phase 0 — Environment Setup
1. Create virtual environment:  
   ```bash
   python3 -m venv .venv && source .venv/bin/activate
   ```
2. Install base deps:  
   ```bash
   pip install fastapi uvicorn chromadb litellm sqlite-utils
   npm create vite@latest frontend --template react
   cd frontend && npm install axios
   ```
3. Create `.env` with API keys and Ollama model names.

---

## Phase 1 — Backend Scaffolding
- [ ] `backend/main.py`: FastAPI app with `/chat`, `/memories`, `/models` routes  
- [ ] `backend/memory.py`: ChromaDB + SQLite integration  
- [ ] `backend/llm.py`: LiteLLM wrapper with model switcher  
- [ ] `backend/models.py`: data schemas and validation  
- [ ] Confirm backend runs: `uvicorn backend.main:app --reload`

---

## Phase 2 — Frontend Scaffolding
- [ ] `frontend/src/components/MemoryPanel.jsx`
- [ ] `frontend/src/components/ChatPanel.jsx`
- [ ] `frontend/src/components/ModelSelector.jsx`
- [ ] Integrate API calls (axios)
- [ ] Display live context count and token usage
- [ ] Stream responses incrementally

---

## Phase 3 — Integration Loop
- [ ] Connect memory search to backend
- [ ] Implement manual context checkboxes
- [ ] Save conversations to SQLite
- [ ] Verify switching between models works mid-session

---

## Phase 4 — Polish
- [ ] Add tagging + search filters  
- [ ] Add export/import (JSON/Markdown)  
- [ ] Keyboard shortcuts (Ctrl+Enter = send)  
- [ ] UI cleanup and persistence  

---

## Phase 5 — Optional Enhancements
- [ ] Auto-suggest relevant memories  
- [ ] Token analytics dashboard  
- [ ] Memory summarization (using chosen model)  
- [ ] Data cleanup utilities  

---

## Future Work (Post-MVP)
- Multi-user mode  
- Mobile client  
- Graph view of memory relationships  
- Plugin hooks  
- Local fine-tuning on memory corpus  

---

**Command Summary:**
```bash
# Run backend
uvicorn backend.main:app --reload

# Run frontend
cd frontend && npm run dev
```

**Tip:** Commit between each completed phase:
```bash
git add . && git commit -m "phase1 complete"
```
