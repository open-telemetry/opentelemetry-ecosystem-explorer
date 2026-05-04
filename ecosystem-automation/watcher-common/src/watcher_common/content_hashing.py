import hashlib

HASH_LENGTH = 12

def compute_content_hash(content: bytes | str) -> str:
    """Return first 12 hex chars of SHA-256 over raw content."""
    if isinstance(content, str):
        content = content.encode("utf-8")
    return hashlib.sha256(content).hexdigest()[:HASH_LENGTH]