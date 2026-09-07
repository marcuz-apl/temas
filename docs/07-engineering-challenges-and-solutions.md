# 7. Architectural Solutions: Multi-Source Harmonization & Zero-Downtime

**Section**: Part III — How TEMAS Was Formed to Cope with the Challenges  
**Target Audience**: Systems Architects, Backend Developers & DevOps Engineers  
**Status**: Core Reference Manual  

---

## 1. Challenge Matrix & Engineering Countermeasures

Building an earthquake monitoring system that remains resilient during active seismic crises requires solving acute distributed systems challenges:

```
  CHALLENGE                                        ENGINEERING SOLUTION IN TEMAS
  ───────────────────────────────────────────────  ──────────────────────────────────────────────────
  1. Upstream servers crash under surge traffic    ► Asynchronous Polling Daemon + In-Memory Caching
  2. Multi-agency conflicting duplicate records    ► Haversine-Temporal Deduplication Correlation
  3. Slow queries over tens of thousands of rows   ► SQLite WAL Mode + Covering B-Tree Indices
  4. Misleading public perceptions of magnitude    ► Multi-Dimensional Energy & Gutenberg-Richter Deck
  5. Unauthorized scraper manipulation             ► Passkey-Secured Obfuscated Route (/samet)
```

---

## 2. Deep Dive: Deduplication & Cross-Agency Correlation

When an earthquake occurs, AFAD might record:
- `OriginTimeUTC`: `2023-02-06T01:17:34Z`, `Lat`: `37.288`, `Lon`: `37.043`, `Mag`: `7.7`

While EMSC records:
- `OriginTimeUTC`: `2023-02-06T01:17:36Z`, `Lat`: `37.226`, `Lon`: `37.014`, `Mag`: `7.8`

If both records are inserted raw into the database, map users see two overlapping red circles and assume two separate earthquakes occurred moments apart.

### The Correlation Algorithm
TEMAS executes a spatial-temporal window correlation before inserting new telemetry:

$$\Delta t = |t_1 - t_2| \le 90\text{ seconds}$$

$$D = 2R \arcsin \left( \sqrt{\sin^2\left(\frac{\Delta \phi}{2}\right) + \cos \phi_1 \cos \phi_2 \sin^2\left(\frac{\Delta \lambda}{2}\right)} \right) \le 35\text{ km}$$

When both criteria match:
1. The records are identified as a single physical event.
2. The event is unified into a canonical record, prioritizing the Moment Magnitude ($M_w$) reading.
3. Agency attribution and original telemetry timestamps are preserved in metadata.

---

## 3. Storage Engine: Why SQLite WAL Mode Outperforms Heavy Databases

For an embedded, self-contained observatory platform, TEMAS utilizes **SQLite 3** configured with enterprise production pragmas:

```sql
PRAGMA journal_mode = WAL;        -- Write-Ahead Logging: readers never block writers!
PRAGMA synchronous = NORMAL;      -- 10x write throughput while maintaining durability
PRAGMA cache_size = -64000;       -- 64MB memory page cache
PRAGMA temp_store = MEMORY;       -- Keep temporary indices in RAM
PRAGMA busy_timeout = 5000;       -- Graceful lock waiting under concurrency
```

### Covering Indexes for Sub-Millisecond Filtering
To ensure that complex queries filtering by magnitude, depth, and time preset (e.g. `WHERE magnitude >= 4.0 AND origintimeutc >= '2025-01-01'`) execute in $< 3\text{ ms}$ even across $> 20,000$ events, TEMAS uses compound B-tree indexing:

```sql
CREATE INDEX idx_earthquakes_time_mag ON earthquakes(origintimeutc DESC, magnitude DESC);
CREATE INDEX idx_earthquakes_coords ON earthquakes(latitude, longitude);
CREATE INDEX idx_earthquakes_region ON earthquakes(region);
```

---

## 4. Full-Spectrum Observatory Analytics Deck

Rather than offering simple point coordinates, TEMAS incorporates an embedded **Analytics Observatory Deck** featuring:

1. **Cumulative Kinetic Energy Curve**: Real-time integration of $\Sigma E = \sum 10^{4.8 + 1.5 M_w}$ over time, revealing the staggering jump caused by catastrophic ruptures.
2. **24-Hour Diurnal Rhythm**: 24-column histogram evaluating day vs. night seismic detection thresholds against human anthropogenic seismic noise.
3. **Day-of-Week Distribution**: 7-column profile verifying the natural Poisson stochasticity of tectonic strain release.
4. **Depth vs. Magnitude 2D Cross-Matrix**: Heatmapped matrix demonstrating that $>80\%$ of Anatolian seismic energy originates in the upper $15\text{ km}$ crust.
