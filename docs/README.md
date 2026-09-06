# TEMAS Technical Notes & Architecture Manual

This directory serves as the engineering knowledge base, seismological design rationale, and technical notes repository for the **TEMAS (Turkey Earthquake Monitoring & Alert System)** project.

---

## Technote & Changelog Directory Index

| Document | Title | Core Focus |
| :--- | :--- | :--- |
| **[CHANGELOG](CHANGELOG.md)** | **Milestone Calibration (v2.1.0 $\to$ v2.10.4)** | Full semantic progression matrix, feature scopes, and deliverables from inception through Gen2. |
| **[TECHNOTE-01](technote-01-data-ingestion-and-polling-strategy.md)** | **Data Ingestion Cadence & Upstream Rate-Limit Safety** | Polling intervals, seismic wave solver latencies, provider courtesy, and circuit-breaker failover. |
| **[TECHNOTE-02](technote-02-seismic-catalog-hygiene-and-storage.md)** | **Catalog Hygiene, Noise Purging & Deduplication Engine** | M < 2.0 noise cut-off rationale, composite event deduplication, SQLite WAL mechanics, and backfill. |
| **[TECHNOTE-03](technote-03-security-and-administrative-operations.md)** | **Security Architecture, Concealed Route & Operator Ergonomics** | Concealed `/samet` route, deceptive 404 decoy, inception credentials (`Tema$2023`), dynamic passkey changes, and About modal. |

---

## Guiding Engineering Principles

1. **Seismological Reality First**: Architectural decisions (such as polling intervals and noise filtering) are driven by physical geodynamics and observatory station mechanics, not arbitrary software defaults.
2. **Academic & Public Good Courtesy**: Upstream seismic networks (especially academic observatories like Boğaziçi University / KOERI) must never be overwhelmed. Polling frequency balances prompt alert dispatch with zero risk of IP blacklisting.
3. **Data Integrity Over Volume**: Quality over raw count. Micro-tremors below detection thresholds and duplicated multi-agency reports are filtered and deduplicated to maintain an actionable, high-fidelity catalog.
4. **Resilient Local Persistence**: Once ingested, seismic data is permanent. Operations should never depend on re-scraping historical catalogs during routine dashboard operations.
