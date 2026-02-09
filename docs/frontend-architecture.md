# Frontend Architecture

The React-based web application that provides an interactive interface for exploring
OpenTelemetry component metadata.

## Overview

The ecosystem-explorer is a static web application built with React, TypeScript, and Vite.
It consumes the content-addressed database and provides search, filtering, and comparison
capabilities with offline support through IndexedDB caching.

## Technology Stack

- **Framework**: React + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS v4
- **Testing**: Vitest + React Testing Library
- **Caching**: IndexedDB via `idb`
- **Deployment**: Static site hosting

### IndexedDB Cache

Persistent storage across browser sessions using `idb` library wrapper.

**Stores**:

- `metadata`: Versions and manifests
- `instrumentations`: Full instrumentation data

**Entry Format**:

```typescript
interface CacheEntry<T> {
  data: T;
  cachedAt: number;   // For future TTL
}
```

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
