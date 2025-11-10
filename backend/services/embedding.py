from __future__ import annotations

import logging
from typing import Dict, List, Sequence, Tuple

try:  # pragma: no cover - optional dependencies
    import numpy as np
except ImportError:  # pragma: no cover
    np = None  # type: ignore

try:  # pragma: no cover - optional dependencies
    import faiss  # type: ignore
except ImportError:  # pragma: no cover
    faiss = None  # type: ignore

try:  # pragma: no cover - optional dependencies
    from sentence_transformers import SentenceTransformer
except ImportError:  # pragma: no cover
    SentenceTransformer = None  # type: ignore

_model: SentenceTransformer | None = None
_index: "faiss.IndexFlatIP" | None = None
_vectors: Dict[str, "np.ndarray"] = {}
_ordering: List[str] = []
_dimension: int = 0
_ready: bool = False


def _ensure_backend() -> bool:
    global _model, _index, _dimension, _ready
    if _ready and _model is not None and _index is not None:
        return True
    if SentenceTransformer is None or faiss is None or np is None:
        logging.warning("Embedding backend unavailable (missing sentence-transformers/faiss).")
        return False
    _model = SentenceTransformer("all-MiniLM-L6-v2")
    _dimension = int(_model.get_sentence_embedding_dimension())
    _index = faiss.IndexFlatIP(_dimension)
    _ready = True
    return True


def _encode(text: str) -> "np.ndarray | None":
    if not text or not _ensure_backend():
        return None
    vector = _model.encode([text], convert_to_numpy=True)  # type: ignore[arg-type]
    vector = np.asarray(vector, dtype="float32")
    if vector.ndim == 1:
        vector = np.expand_dims(vector, axis=0)
    faiss.normalize_L2(vector)
    return vector


def _rebuild_index() -> None:
    if not _ensure_backend():
        return
    assert _index is not None
    _index.reset()
    if not _vectors:
        _ordering.clear()
        return
    matrix = np.stack(list(_vectors.values())).astype("float32")
    _ordering[:] = list(_vectors.keys())
    faiss.normalize_L2(matrix)
    _index.add(matrix)


def clear() -> None:
    """Remove all stored embeddings."""
    if not _ensure_backend():
        return
    _vectors.clear()
    _ordering.clear()
    _index.reset()  # type: ignore[union-attr]


def bulk_register(entries: Sequence[Tuple[str, str]]) -> None:
    """Replace the current index with the supplied (id, text) pairs."""
    if not entries:
        clear()
        return
    if not _ensure_backend():
        return
    temp: Dict[str, "np.ndarray"] = {}
    for mem_id, text in entries:
        vector = _encode(text)
        if vector is None:
            continue
        temp[mem_id] = vector[0]
    _vectors.clear()
    _vectors.update(temp)
    _rebuild_index()


def remove(mem_id: str) -> None:
    """Remove a single memory embedding."""
    if mem_id in _vectors:
        del _vectors[mem_id]
        _rebuild_index()


def embed(text: str, mem_id: str) -> None:
    """Encode and store an embedding for a single memory."""
    vector = _encode(text)
    if vector is None:
        return
    _vectors[mem_id] = vector[0]
    _rebuild_index()


def search(query: str, k: int = 5) -> Tuple[List[str], List[float]]:
    """Return matching memory IDs and similarity scores."""
    if not query or not _ensure_backend() or not _vectors or _index is None:
        return [], []
    vector = _encode(query)
    if vector is None:
        return [], []
    k = min(k, len(_vectors))
    distances, indices = _index.search(vector, k)  # type: ignore[union-attr]
    matched_ids: List[str] = []
    matched_scores: List[float] = []
    for idx, score in zip(indices[0], distances[0]):
        if idx < 0 or idx >= len(_ordering):
            continue
        matched_ids.append(_ordering[idx])
        matched_scores.append(float(score))
    return matched_ids, matched_scores
