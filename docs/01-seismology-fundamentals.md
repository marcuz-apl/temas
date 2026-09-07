# 1. Seismological Fundamentals: Physics, Waves & Ruptures

**Section**: Part I — General Knowledge of Earthquakes, Seismology & Surveillance  
**Target Audience**: Geophysicists, Civil Engineers, Disaster Planners & General Public  
**Status**: Core Reference Manual  

---

## 1. What Is an Earthquake?

At its most fundamental physical level, an **earthquake** is the rapid release of elastic strain energy accumulated within the Earth's brittle lithospheric crust. 

Tectonic plates are in perpetual, slow-motion convection driven by heat dissipation from the Earth's mantle and core. As these colossal rock masses grind past, collide with, or pull apart from one another, frictional resistance along fault interfaces locks the tectonic boundaries in place. While the plates continue to move at rates ranging from millimeters to centimeters per year, the locked fault zones deform elastically.

```
       Locked Fault Interface (Stress Accumulation Phase)
     ────────────────────────────────────────────────────────
     [ Plate A  -----> ]  || (Locked Zone) ||  [ <----- Plate B ]
     ────────────────────────────────────────────────────────
                        Strain Energy Increases
                                   │
                                   ▼
                   Shear Stress > Frictional Resistance
                                   │
                                   ▼
                BRITTLE SHEAR FAILURE (CO-SEISMIC RUPTURE)
```

When shear stress exceeding the frictional strength of the asperities (interlocking rock irregularities) is reached, the locked interface fails cataclysmically. This sudden brittle fracture is known as **co-seismic slip**. The stored elastic potential energy is converted instantaneously into:
1. **Frictional Heat** along the fault rupture plane (~80–90%).
2. **Rock Crushing and Pulverization** (creation of fault gouge).
3. **Radiated Seismic Waves** (~5–15%), which propagate omnidirectionally through the Earth's interior and along its surface.

---

## 2. Anatomy of an Earthquake: Hypocenter vs. Epicenter

To understand seismic telemetry and event records in the TEMAS catalog, precision regarding geometric terminology is essential:

| Parameter | Scientific Definition | Practical Implication |
| :--- | :--- | :--- |
| **Hypocenter (Focal Point)** | The exact three-dimensional spatial coordinate $(x, y, z)$ within the lithosphere where the rock rupture initiates. | Governs energy dispersion and attenuation; shallow hypocenters concentrate shaking. |
| **Epicenter** | The surface geographic point $(\phi, \lambda)$ lying vertically directly above the hypocenter ($z = 0$). | The point cited in public news bulletins and map pins. |
| **Focal Depth ($h$)** | The vertical distance from the Earth's surface down to the hypocenter (measured in kilometers). | **Crucial metric:** A $M_w 6.0$ at $7	ext{ km}$ depth is far more destructive than a $M_w 7.0$ at $150	ext{ km}$ depth. |
| **Fault Plane & Rupture Area** | The planar geological surface across which rock displacement occurs (Length $L 	imes$ Width $W$). | Major earthquakes are not single points; a $M_w 7.8$ ruptures a zone $300	ext{--}400	ext{ km}$ long. |
| **Slip Vector ($D$)** | The relative displacement distance of rock masses across the fault plane during the event. | Varies from millimeters in microseisms to $> 7	ext{ meters}$ in megathrust events. |

```
                       SURFACE (Z = 0)
───────────────────────────────★ Epicenter ─────────────────────────────
                              │
                              │ Focal Depth (h)
                              │
                              ▼
                         ● Hypocenter (Rupture Initiation)
                       ╱   ╲
                      ╱     ╲   Seismic Waves (P, S, Surface)
                     ╱ Fault ╲  Propagating Outward
                    ╱  Plane  ╲
```

### Depth Classification Standards
- **Shallow Crustal**: $0 \le h \le 30	ext{ km}$ (Characteristics of $>85\%$ of earthquakes in Turkey; high ground accelerations, extreme local damage).
- **Intermediate**: $30 < h \le 70	ext{ km}$ (Moderate attenuation before wave reaching surface).
- **Deep-Focus**: $h > 70	ext{ km}$ (Occurs primarily in deep subduction zones such as the Hellenic-Cyprus Arc subducting slab).

---

## 3. The Wave Spectrum: How Energy Travels Through Rock

Seismic waves are classified into two primary categories: **Body Waves** (which penetrate the volume of the planet) and **Surface Waves** (which travel along the crustal interface).

### 3.1 Body Waves

#### 1. Primary Waves (P-Waves / Compressional)
- **Physics**: Longitudinal elastic waves where particles oscillate parallel to the direction of wave propagation (alternating zones of compression and dilation).
- **Velocity**: Typically $5.5	ext{--}8.0	ext{ km/s}$ in the continental crust (fastest of all seismic waves).
- **Medium**: Propagates through solids, liquids, and gases.
- **Physical Sensation**: Often experienced as an initial sudden vertical thump or sharp rattling sound (acoustic coupling into the atmosphere).
- **Surveillance Value**: Forms the foundation of **Earthquake Early Warning (EEW)** systems because they arrive first, preceding the destructive secondary waves.

#### 2. Secondary Waves (S-Waves / Shear)
- **Physics**: Transverse elastic waves where particle motion is perpendicular to the direction of wave travel.
- **Velocity**: Typically $3.0	ext{--}4.8	ext{ km/s}$ ($\sim 60\%$ of P-wave velocity: $V_s pprox V_p / \sqrt{3}$).
- **Medium**: **Solids only**. Cannot propagate through liquids or gases because fluids cannot support shear stress (this fundamental property proved that Earth's outer core is liquid).
- **Physical Sensation**: Severe side-to-side, horizontal swaying motion.
- **Hazard Profile**: Highly destructive to civil infrastructure; unreinforced masonry and multi-story structures are notoriously vulnerable to horizontal shear.

### 3.2 Surface Waves (Dispersive & High Amplitude)

Surface waves travel slower than body waves ($V_{	ext{surface}} < V_s$) but carry significantly higher amplitude over long epicentral distances because their energy attenuates geometrically as $1/r$ (cylindrical spreading), whereas body waves attenuate as $1/r^2$ (spherical spreading).

#### 1. Rayleigh Waves (Ground Roll)
- Elliptical retrograde particle motion in the vertical-radial plane (analogous to ocean waves).
- Produces rolling sensations across sedimentary plains and basins.

#### 2. Love Waves (Horizontal Transverse)
- Purely horizontal particle motion transverse to the direction of propagation.
- Causes intense torsional and twisting stresses on building foundations and tall structures.

---

## 4. Fundamental Statistical Laws of Seismology

Natural seismicity is non-periodic and stochastic, yet globally and regionally it adheres strictly to two foundational empirical physical laws:

### 4.1 The Gutenberg-Richter Law (Frequency-Magnitude Relation)

Introduced by Beno Gutenberg and Charles Richter in 1944, this law defines the statistical distribution of earthquake frequencies:

$$\log_{10} N = a - bM$$

Where:
- $N$ is the cumulative number of earthquakes having magnitude $\ge M$ in a given region over a specific time window.
- $a$ is the seismic productivity/activity rate of the region.
- $b$ is the scaling parameter (the **b-value**), which physically reflects the stress state and tectonic heterogeneity of the crust.

> [!NOTE]
> **Physical Significance of the b-Value**:
> In stable tectonic equilibrium, $b pprox 1.0$. This means for every single $M \ge 6.0$ earthquake, there are statistically $\sim 10$ events of $M \ge 5.0$, $\sim 100$ events of $M \ge 4.0$, and $\sim 1,000$ events of $M \ge 3.0$. A localized drop in $b$ below $0.8$ often indicates high tectonic shear stress concentration and asperities locking prior to major failures.

### 4.2 Omori-Utsu Law (Aftershock Decay Temporal Kinetics)

After a major mainshock, aftershocks occur due to co-seismic stress redistribution onto adjacent fault segments and viscoelastic relaxation of the lower crust. The rate of aftershock occurrence $n(t)$ decays as a power-law function of time $t$:

$$n(t) = rac{K}{(t + c)^p}$$

Where:
- $t$ is elapsed time since the mainshock.
- $K$ represents aftershock productivity.
- $c$ is a small time constant preventing singularity at $t = 0$.
- $p$ is the decay exponent (typically between $0.9$ and $1.3$).

Aftershock sequences following severe continental strike-slip ruptures (such as the 2023 Kahramanmaraş sequence) persist for **years**, gradually tapering back to background regional baselines.
