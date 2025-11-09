# Synapse

Synapse is a modular, self-expanding AI interface that integrates local and cloud models (OpenAI, Ollama, Groq, Anthropic, etc.) through a unified FastAPI backend and React-based frontend. It supports contextual memory, summarization, and model orchestration through a dynamic UI.

## Features

- ✅ Multi-model support (OpenAI + Ollama)
- 💾 Persistent memory system (vector + tag-based)
- ⚙️ Dynamic model discovery and configuration
- 💬 Real-time chat interface with autosized input
- 🔄 Local/offline resilience and blank-slate mode

## Stack

- Backend: FastAPI (Python)
- Frontend: React + Vite + Tailwind
- Database: SQLite / JSON-based memory
- Models: OpenAI (GPT-4, GPT-5, etc.), Ollama local LLMs

## Setup

```bash
git clone https://github.com/<YOUR_USERNAME>/synapse.git
cd synapse
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cd frontend && npm install && npm run build
```

## Environment Variables (.env)

```
OPENAI_API_KEY=your_openai_key
OLLAMA_BASE_URL=http://127.0.0.1:11434
```

Never commit this file.

## Running Locally

```bash
uvicorn backend.main:app --reload
cd frontend && npm run dev
```

Then open [http://localhost:5175](http://localhost:5175).

## License

MIT License © 2025 Timmy Thomas
