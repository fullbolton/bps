# BPS — Technical Stack Decision

## Purpose

This document defines the initial technical stack and architecture direction for BPS.

Its purpose is to:
- keep technical decisions aligned with the product center
- prevent premature over-engineering
- establish a stable implementation foundation
- ensure the system does not drift into a generic admin template

This document is technical direction, not implementation detail.
It does not define database schema.
It does not define API contracts.
It does not replace product, workflow, status, or role rules.

---

## 1. Product Context

BPS is a **web-based internal office operations interface**.

It is centered on:
- companies
- contract lifecycle
- staffing demand
- active workforce visibility
- appointments
- tasks
- documents
- financial summary / management visibility

Because BPS is an internal office product with desktop-first usage, the technical stack should optimize for:
- fast internal iteration
- clear role-aware visibility
- structured operational data
- document handling
- maintainable shared UI primitives

---

## 2. Chosen Stack

### Frontend
- **Next.js (App Router)**
- **TypeScript**
- **Tailwind CSS**

### Backend Platform
- **Supabase Postgres**
- **Supabase Auth**
- **Supabase Storage**

### Recommended Architecture Direction
- **UI layer**
- **application/domain layer**
- **Supabase access layer**

---

## 3. Why This Stack

### 3.1 Why Next.js
BPS is a web product, not a mobile-first app.
Next.js provides a strong base for:
- desktop-first internal tooling
- modular routing
- nested layouts
- clear screen structure
- shared shell patterns
- future server-side boundaries if needed

This fits BPS because the product relies on:
- a persistent shell
- module-based navigation
- company-centered detail surfaces
- reusable table/detail/layout patterns

### 3.2 Why TypeScript
BPS has many interconnected operational concepts:
- company
- contract
- staffing demand
- appointments
- tasks
- documents
- financial summary visibility

TypeScript helps prevent silent drift between:
- shared UI primitives
- status vocabulary
- role-aware visibility
- workflow assumptions

The more screen surfaces BPS gains, the more important typed consistency becomes.

### 3.3 Why Tailwind CSS
BPS needs fast internal product development without losing component discipline.

Tailwind is chosen because it:
- supports fast iteration
- works well with a shared component system
- avoids premature heavy design-system complexity
- allows the team to build BPS-specific surfaces instead of falling into generic admin themes

Tailwind should support the component system.
It should not replace the component system.

### 3.4 Why Supabase
Supabase is the preferred platform because it gives BPS one integrated base for:
- relational data
- authentication
- storage
- controlled access patterns

This is especially useful because BPS needs:
- structured operational records
- role-aware internal access
- document/file storage
- a path to production without managing infrastructure too early

The existing Supabase Pro setup makes this even more practical.

---

## 4. Architecture Rule

### Core rule
BPS must **not** become:
- a frontend that directly talks to the database from every screen
- a pile of component-level data access
- a generic internal CRUD panel

### Required separation
The implementation should preserve this structure:

**UI**
→ shared components and screens

**Application / Domain Layer**
→ business rules, orchestration, workflow shaping, visibility decisions

**Supabase Access Layer**
→ actual data access and storage operations

### Why this matters
Without this separation:
- product logic leaks into screens
- role logic gets duplicated
- workflow behavior becomes inconsistent
- Company Detail loses its centrality
- Financial Summary risks expanding in the wrong direction

---

## 5. What We Are Not Adding Now

The following are intentionally excluded from the initial technical decision:

### Not adding now
- Prisma
- a separate custom backend framework
- a second authentication system
- a separate file-storage platform
- a complex event bus
- a real-time-first architecture
- a workflow engine
- a generic admin template dependency as product foundation

### Why
The current goal is controlled internal product delivery.
Adding extra infrastructure layers too early would:
- slow delivery
- multiply architecture decisions
- hide product mistakes behind technical complexity

---

## 6. Realtime Position

Realtime is **not** part of the initial core architecture.

It may be considered later for narrow use cases such as:
- limited live task updates
- announcements
- simple operational refresh behavior

It should not be introduced early just because the platform supports it.

BPS should first prove:
- screen structure
- workflow discipline
- role boundaries
- company-centered navigation

before adding realtime behavior.

---

## 7. Auth Direction

BPS should use **Supabase Auth** for internal office access.

Initial auth expectations:
- internal user login
- role-aware visibility
- conservative access model
- no overbuilt auth complexity at the beginning

This means:
- authentication is necessary
- a full permissions platform is not

Role logic should stay aligned with:
- `ROLE_MATRIX.md`
- `WORKFLOW_RULES.md`
- `CODEX.md`

---

## 8. Storage Direction

BPS should use **Supabase Storage** for document handling.

Storage must follow product rules:
- documents are contextual
- documents are not just folders
- files should remain tied to company / contract / operational context
- access should stay conservative
- document handling should reinforce compliance visibility, not passive archiving

Storage design must not drift into a generic drive-like file system.

---

## 9. Shared UI Principle

The stack must support the documented shared component system.

This means:
- shared primitives first
- screen assembly second
- workflow-aware surfaces later

The stack exists to support:
- `PageHeader`
- `StatusBadge`
- `RiskBadge`
- `DataTable`
- `EmptyState`
- `TabNavigation`
- `CommercialSummaryCard`
and similar documented primitives.

The stack must not encourage one-off screen widgets as the default approach.

---

## 10. Risks This Decision Is Preventing

This decision is meant to prevent the following mistakes:

### 10.1 Generic admin panel drift
Using a ready-made admin approach too early can make BPS feel like:
- a CRM shell
- a random internal dashboard
- disconnected CRUD pages

### 10.2 UI-to-database sprawl
If screens directly own Supabase access:
- product logic becomes fragmented
- role rules become inconsistent
- maintenance cost rises quickly

### 10.3 Premature infrastructure layering
Adding ORM + extra backend + extra auth + extra storage too early would create:
- complexity without product value
- slower iteration
- architectural noise

### 10.4 Financial overreach
The stack must not be used as justification to expand BPS into:
- accounting software
- payroll software
- ERP behavior

---

## 11. Initial Technical Principles

1. **Web-first, desktop-first**
2. **Shared shell first**
3. **Shared primitives before screen-specific widgets**
4. **Domain/application layer between UI and Supabase**
5. **Conservative auth and access**
6. **Contextual storage, not generic file dumping**
7. **No premature ORM or backend layering**
8. **No realtime-first architecture**
9. **No technical choice should weaken Company Detail centrality**
10. **No technical choice should push Financial Summary beyond visibility-first**

---

## 12. Final Decision

BPS will initially use:

- **Next.js App Router**
- **TypeScript**
- **Tailwind CSS**
- **Supabase Postgres**
- **Supabase Auth**
- **Supabase Storage**

This stack is chosen because it is:
- fast enough for internal product delivery
- structured enough for operational complexity
- disciplined enough to support the BPS documentation system
- simple enough to avoid unnecessary platform sprawl

This is the default technical direction unless a later explicit architecture decision replaces it.
