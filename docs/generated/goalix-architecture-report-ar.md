# Goalix Architecture Report - Mermaid Appendix

مهم: بناء على طلبك، الـ PDF لا يحتوي Mermaid code. هذا الملف فقط يحتفظ بالأكواد الخام لو احتجت تنسخها في draw.io أو Mermaid Live Editor أو GitHub.

## High Level System

```mermaid
flowchart LR
    U[Users] --> N[Nginx Reverse Proxy]
    N --> FE[Next.js Frontend]
    N --> API[Express API]
    FE --> PXY[Next.js API Proxy]
    PXY --> API
    API --> PG[(PostgreSQL)]
    API --> RD[(Redis)]
    API --> Q[BullMQ Queues]
    Q --> W[Worker Process]
    W --> PG
    API <--> SIO[Socket.IO]
```

## Queue Pipeline

```mermaid
sequenceDiagram
    participant API as Express API
    participant Redis as Redis/BullMQ
    participant Worker as Worker
    participant DB as PostgreSQL
    API->>Redis: add(jobName, payload)
    Redis-->>API: job id / queued
    Worker->>Redis: claim next job
    Worker->>DB: execute side effect
    Worker->>Redis: complete / fail / retry
```

## Redis Dependency Map

```mermaid
flowchart TB
    Redis[(Redis)] --> BullMQ[BullMQ Queues]
    Redis --> RateLimit[Rate Limit Counters]
    Redis --> Session[Auth Session Cache]
    Redis --> JsonCaches[Short JSON Caches]
    Redis --> Socket[Socket.IO Adapter]
    Redis --> Locks[Automation Locks]
```

## Current Docker Topology

```mermaid
flowchart TB
    N[Nginx] --> FE[frontend]
    N --> API[api]
    API --> PG[(postgres)]
    API --> RD[(redis)]
    WK[worker] --> PG
    WK --> RD
    M[migrate] --> PG
```
