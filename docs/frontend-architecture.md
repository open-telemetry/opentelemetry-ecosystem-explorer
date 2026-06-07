# Frontend Architecture

The React-based web application that provides an interactive interface for exploring OpenTelemetry
component metadata.

## Overview

The ecosystem-explorer is a static web application built with React, TypeScript, and Vite. It
consumes the content-addressed database and provides search, filtering, and comparison capabilities
with offline support through IndexedDB caching.

## Technology Stack

- **Framework**: React + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS v4
- **Testing**: Vitest + React Testing Library
- **Caching**: IndexedDB via `idb`
- **Deployment**: Static site hosting

### IndexedDB Cache

Persistent storage across browser sessions using `idb` library wrapper.

**Stores** (defined in `src/lib/api/idb-cache.ts`):

- `metadata`: Versions and manifests (also holds internal bookkeeping such as the last-prune marker)
- `instrumentations`: Full content-addressed component data (Java Agent instrumentations and
  Collector components)
- `configuration`: Declarative configuration schema data
- `global-configurations`: Aggregated, deduplicated configuration options across all versions

**Entry Format**:

```typescript
interface CacheEntry<T> {
  key: string;
  data: T;
  cachedAt: number; // Used for the 24h TTL and pruning
  lastAccessedAt?: number;
}
```

Entries expire after 24 hours (`CACHE_EXPIRATION_MS`) and are pruned on a 24-hour interval.

### Request Flow

```text
User requests component "aws-sdk-2.2" for version "2.24.0"
    ↓
Check IndexedDB cache
    ├─ HIT → Store in memory, return
    └─ MISS ↓
Check in-flight requests (deduplication)
    ├─ EXISTS → Wait for existing request
    └─ NEW ↓
Fetch from network
    ↓
Store in IndexedDB
    ↓
Return to caller
```
