"""
Backend package for the Synapse AI command console.
Initialises configuration helpers and exposes shared singletons.
"""

from .config import Settings, get_settings  # noqa: F401

__all__ = ["Settings", "get_settings", "__version__"]
__version__ = "0.7.0"
