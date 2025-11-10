# Synapse

<div align="center">

**A modular, self-expanding AI interface with contextual memory**

[![Version](https://img.shields.io/badge/version-0.7.0-blue.svg)](https://github.com/yourusername/synapse)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.9+-blue.svg)](https://www.python.org/)
[![React](https://img.shields.io/badge/react-19.1+-61dafb.svg)](https://reactjs.org/)

[Features](#features) • [Installation](#installation) • [Usage](#usage) • [Documentation](#documentation) • [Contributing](#contributing)

</div>

---

## Overview

Synapse is a **model-agnostic AI command console** that integrates local and cloud models (OpenAI, Ollama, Groq, Anthropic, etc.) through a unified FastAPI backend and React-based frontend. It provides total human control over memory and context, allowing seamless switching between models while maintaining a consistent, local memory layer.

> **Current Release:** v0.7.0 (previous stable: v0.6.6 — see [CHANGELOG](CHANGELOG.md))
>
> **Latest Update:** Critical bug fixes and code improvements (November 2025) - See [Recent Fixes](#recent-fixes)

### Core Philosophy

- **Human-in-the-loop memory** — users manually select injected memories
- **Model agnostic** — use OpenAI, Anthropic, Groq, or local Ollama models
- **Sovereignty first** — privacy, local persistence, full user control
- **Simplicity before autonomy** — clarity first, automation later
- **Transparency > automation** — always know what's happening

---

## Features

### Current Features (v0.7.0)

- **Multi-model support** — Seamlessly switch between OpenAI, Ollama, Groq, Anthropic models
- **Persistent memory system** — Vector-based (ChromaDB) + tag-based memory storage
- **Dynamic model discovery** — Automatically detect available models from configured providers
- **Real-time chat interface** — Streaming responses with autosized input
- **Context injection** — Manual memory selection with real-time token tracking
- **Local/offline resilience** — Works offline with local Ollama models
- **Model configuration UI** — Cost-tier visualization and persistent preferences
- **Responsive design** — Tailwind CSS-based UI with dark mode support

### Planned Features

- Tag filtering and advanced search in memory panel
- Auto-suggest memories (user-approved)
- Conversation export/import (JSON/Markdown)
- Memory editing and cleanup tools
- Multi-turn context injection assistant
- Memory graph visualization

---

## Architecture

### Stack

| Component | Technology |
|-----------|-----------|
| **Backend** | FastAPI (Python) |
| **Frontend** | React 19 + Vite + Tailwind CSS |
| **Vector Database** | ChromaDB (lightweight) or Qdrant (for scale) |
| **Model Layer** | LiteLLM (abstraction for multiple providers) |
| **Storage** | SQLite for metadata + raw text archives |
| **Local Inference** | Ollama integration |

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (React)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Chat Panel   │  │ Memory Panel │  │ Model Config │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                    (Axios / WebSocket)
                            │
┌─────────────────────────────────────────────────────────────┐
│                   Backend (FastAPI)                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ LLM Router   │  │ Memory Store │  │ Context Mgr  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
        │                   │                    │
        │                   │                    │
   ┌────┴────┐         ┌────┴────┐         ┌────┴────┐
   │ LiteLLM │         │ ChromaDB│         │ SQLite  │
   └─────────┘         └─────────┘         └─────────┘
        │
   ┌────┴─────────────────────────┐
   │  OpenAI | Ollama | Anthropic │
   └──────────────────────────────┘
```

### Project Structure

```
synapse/
├── backend/                    # FastAPI backend
│   ├── main.py                # Application entry point
│   ├── config.py              # Configuration management
│   ├── dependencies.py        # Dependency injection
│   ├── llm.py                 # LLM router & model abstraction
│   ├── memory.py              # Memory storage & retrieval
│   ├── models.py              # Pydantic data models
│   ├── routes/                # API route handlers
│   │   └── memory_routes.py
│   └── services/              # Business logic services
│       ├── embedding.py       # Vector embedding service
│       ├── injection.py       # Context injection logic
│       └── summary.py         # Summarization service
├── frontend/                  # React frontend
│   ├── src/
│   │   ├── components/        # React components
│   │   │   ├── ChatPanel.jsx
│   │   │   ├── MemoryPanel.jsx
│   │   │   ├── ModelSelector.jsx
│   │   │   ├── ModelModal.jsx
│   │   │   ├── Header.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   └── ThemeToggle.jsx
│   │   ├── pages/
│   │   │   └── ConfigPage.jsx
│   │   ├── App.jsx           # Main application component
│   │   └── main.jsx          # Entry point
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
├── data/                      # Runtime data (gitignored)
│   ├── vector_store/         # ChromaDB persistence
│   ├── conversations/        # Chat history
│   └── synapse.db           # SQLite database
├── BUILD_ORDER.md            # Development phases
├── BUILD_SPEC.md             # Detailed specification
├── CHANGELOG.md              # Version history
├── LICENSE                   # MIT License
└── README.md                 # This file
```

---

## Installation

### Prerequisites

- **Python 3.9+** (tested on 3.9, 3.10, 3.11)
- **Node.js 18+** and npm
- **Git**
- **Ollama** (optional, for local models) — [Install Ollama](https://ollama.ai)

### Step 1: Clone the Repository

```bash
git clone https://github.com/yourusername/synapse.git
cd synapse
```

### Step 2: Backend Setup

#### Create a virtual environment

```bash
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
```

#### Install Python dependencies

```bash
pip install fastapi uvicorn chromadb litellm requests python-dotenv
```

#### Configure environment variables

Create a `.env` file in the project root:

```bash
# OpenAI Configuration (optional)
OPENAI_API_KEY=your_openai_api_key_here

# Ollama Configuration (optional)
OLLAMA_BASE_URL=http://127.0.0.1:11434

# Anthropic Configuration (optional)
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Groq Configuration (optional)
GROQ_API_KEY=your_groq_api_key_here

# Model Configuration (optional)
DEFAULT_MODEL=ollama/mistral           # Default chat model
SUMMARY_MODEL=openai/gpt-4o            # Model for memory summarization
ANALYSIS_MODEL=openai/gpt-4o           # Model for memory analysis

# Advanced Configuration (optional)
LITELLM_API_BASE=                      # Custom LiteLLM API base URL
DATA_ROOT=./data                       # Data storage directory
```

**Important:** Never commit the `.env` file to version control!

### Step 3: Frontend Setup

```bash
cd frontend
npm install
npm run build  # Build for production
cd ..
```

For development mode (with hot reload):

```bash
cd frontend
npm run dev
```

---

## Usage

### Running the Application

#### Option 1: Production Mode

1. **Build the frontend:**
   ```bash
   cd frontend
   npm run build
   cd ..
   ```

2. **Start the backend:**
   ```bash
   source .venv/bin/activate  # If not already activated
   uvicorn backend.main:app --host 0.0.0.0 --port 8000
   ```

3. **Access the application:**
   Open your browser to [http://localhost:8000](http://localhost:8000)

#### Option 2: Development Mode

**Terminal 1 - Backend:**
```bash
source .venv/bin/activate
uvicorn backend.main:app --reload
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173)

### Using Ollama (Local Models)

1. **Install Ollama:**
   ```bash
   # Follow instructions at https://ollama.ai
   ```

2. **Pull a model:**
   ```bash
   ollama pull llama3.2
   ollama pull mistral
   ```

3. **Start Ollama:**
   ```bash
   ollama serve
   ```

4. **Configure Synapse:**
   Ensure `OLLAMA_BASE_URL=http://127.0.0.1:11434` is set in your `.env` file.

5. **Select Ollama models:**
   In the Synapse UI, open Model Configuration and select your Ollama models.

---

## API Documentation

### Core Endpoints

#### Chat

```http
POST /api/chat
Content-Type: application/json

{
  "message": "Your message here",
  "model": "gpt-4-turbo",
  "memory_ids": ["uuid1", "uuid2"],
  "stream": true
}
```

**Response:** Server-Sent Events (SSE) stream or JSON response

#### List Models

```http
GET /api/models
```

**Response:**
```json
{
  "models": [
    {
      "id": "gpt-4-turbo",
      "provider": "openai",
      "cost_tier": "high",
      "available": true
    }
  ]
}
```

#### Memory Management

```http
# Create memory
POST /api/memories
Content-Type: application/json

{
  "content": "Memory content here",
  "tags": ["tag1", "tag2"],
  "category": "general"
}

# Search memories
GET /api/memories/search?q=query&limit=10

# List all memories
GET /api/memories

# Delete memory
DELETE /api/memories/{memory_id}
```

### Interactive API Documentation

When the backend is running, visit:

- **Swagger UI:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc:** [http://localhost:8000/redoc](http://localhost:8000/redoc)

---

## Configuration

### Model Providers

Synapse uses **LiteLLM** for model abstraction. Supported providers:

| Provider | API Key Required | Local/Cloud | Models |
|----------|------------------|-------------|--------|
| OpenAI | Yes | Cloud | GPT-4, GPT-3.5, etc. |
| Ollama | No | Local | Llama, Mistral, etc. |
| Anthropic | Yes | Cloud | Claude 3.5 Sonnet, etc. |
| Groq | Yes | Cloud | Llama 3, Mixtral, etc. |

### Memory Configuration

Memory is stored in two layers:

1. **SQLite** (`data/synapse.db`) — metadata, tags, timestamps
2. **ChromaDB** (`data/vector_store/`) — vector embeddings for semantic search

Configuration options in `backend/config.py`:

```python
CHROMA_PATH = Path("data/vector_store")
SQLITE_DB = Path("data/synapse.db")
MEMORY_RAW_DIR = Path("data/memories/raw")
MEMORY_MANUAL_DIR = Path("data/memories/manual")
CONVERSATION_DIR = Path("data/conversations")
```

### Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | - | OpenAI API key for GPT models |
| `ANTHROPIC_API_KEY` | - | Anthropic API key for Claude models |
| `GROQ_API_KEY` | - | Groq API key for fast inference |
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | Ollama server endpoint |
| `DEFAULT_MODEL` | `ollama/mistral` | Default model for chat |
| `SUMMARY_MODEL` | `openai/gpt-4o` | Model for memory summarization |
| `ANALYSIS_MODEL` | `openai/gpt-4o` | Model for memory analysis |
| `LITELLM_API_BASE` | - | Custom LiteLLM API base URL |
| `DATA_ROOT` | `./data` | Root directory for data storage |

---

## Development

### Development Workflow

1. **Make changes** to backend or frontend
2. **Test locally** using development servers
3. **Commit changes** with descriptive messages
4. **Follow the build order** in [BUILD_ORDER.md](BUILD_ORDER.md)

### Code Style

- **Backend:** Follow PEP 8 guidelines
- **Frontend:** ESLint configuration in `frontend/eslint.config.js`

### Running Tests

```bash
# Backend tests (if available)
pytest

# Frontend tests
cd frontend
npm test
```

### Building for Production

```bash
# Build frontend
cd frontend
npm run build

# Backend is served directly via uvicorn
```

---

## Roadmap

### v0.8 (Next Release)

- [ ] Tag filtering in memory panel
- [ ] Memory export/import (JSON, Markdown)
- [ ] Enhanced error handling and user feedback
- [ ] Cost tracking per conversation

### v1.0 (Stable)

- [ ] Auto-suggest memories with user approval
- [ ] Memory editing and consolidation tools
- [ ] Advanced context injection strategies
- [ ] Comprehensive test coverage

### v1.5+

- [ ] Memory graph visualization
- [ ] Multi-user support
- [ ] Plugin architecture
- [ ] Mobile and desktop native wrappers

### v2.0+ (Future)

- [ ] Fine-tuned models on user corpus
- [ ] Autonomous "Synapse-Assist" mode
- [ ] Advanced analytics dashboard

See [BUILD_SPEC.md](BUILD_SPEC.md) for detailed specifications.

---

## Contributing

Contributions are welcome! Please follow these guidelines:

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Commit your changes** (`git commit -m 'Add amazing feature'`)
4. **Push to the branch** (`git push origin feature/amazing-feature`)
5. **Open a Pull Request**

### Contribution Areas

- Bug fixes and error handling
- UI/UX improvements
- Documentation enhancements
- New model provider integrations
- Performance optimizations
- Test coverage

---

## Troubleshooting

### Common Issues

**Issue:** Backend fails to start with ChromaDB error

**Solution:** Ensure ChromaDB is installed: `pip install chromadb`

---

**Issue:** Ollama models not appearing

**Solution:**
1. Verify Ollama is running: `ollama serve`
2. Check `OLLAMA_BASE_URL` in `.env`
3. Ensure models are pulled: `ollama pull llama3.2`

---

**Issue:** Frontend can't connect to backend

**Solution:**
- Check backend is running on correct port
- Verify CORS settings in `backend/main.py`
- Check browser console for errors

---

**Issue:** Models returning errors

**Solution:**
- Verify API keys in `.env` are correct
- Check API provider status
- Review backend logs for detailed error messages

---

## License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

Copyright (c) 2025 Timmy Thomas

---

## Acknowledgments

- **FastAPI** — Modern Python web framework
- **React** — UI library
- **LiteLLM** — Multi-provider LLM abstraction
- **ChromaDB** — Vector database for embeddings
- **Tailwind CSS** — Utility-first CSS framework
- **Ollama** — Local LLM runtime

---

## Support

For issues, questions, or suggestions:

- **GitHub Issues:** [Create an issue](https://github.com/yourusername/synapse/issues)
- **Discussions:** [Join the discussion](https://github.com/yourusername/synapse/discussions)

---

## Recent Fixes

### November 2025 - Critical Bug Fixes

Recent code audit identified and fixed several critical issues:

**Critical Fixes:**
- **Removed duplicate code** in `backend/llm.py` that was causing potential runtime errors
- **Added missing import** (`MemoryStore`) in `backend/main.py` for proper type checking

**High Priority Improvements:**
- **Improved cosine similarity calculation** in `backend/memory.py` with better zero-vector handling
- **Configured summary model** in `backend/services/summary.py` to respect `SUMMARY_MODEL` environment variable

**Impact:** All Python files now compile successfully with no syntax errors. The codebase is more robust and properly configured.

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history and release notes.

---

<div align="center">

**Built with control in mind. Memory is yours.**

[⬆ Back to top](#synapse)

</div>
