# Real-Time Math Calculations & Strategies

This document provides a deep dive into the vectorized math engine powering the Disaggregation Engine. It details the exact formulas, override mechanics, and provides sample inputs/outputs for every supported strategy.

---

## 1. Core Concepts (Pre-computation)

Before any strategy executes, the `MathEngine` performs a universally applied **pre-computation step** to handle user locks (overrides).

1. **Calculate Overrides:**
   The engine scans the leaf nodes. If a node has `isoverride: true`, its current value is locked.
   ```text
   Total Override Value = Sum of (node.target_measure) where isoverride == true
   Override Count = Number of nodes where isoverride == true
   ```

2. **Calculate Remaining Values:**
   The remaining value to distribute is the user's total target minus the already locked values.
   ```text
   Remaining Value = Target Value - Total Override Value
   Remaining Nodes = Total Nodes - Override Count
   ```

*(All strategies below operate **only** on the `Remaining Nodes` using the `Remaining Value`)*

---

## 2. Strategy: EQUAL
Distributes the remaining target value evenly across all unlocked leaf nodes.

### Formula
```text
Allocated Value = Remaining Value / Remaining Nodes
```

### Sample Scenario
- **Target Value:** 1,000
- **Measure:** `planned_sales`
- **Total Nodes:** 4
- **Override Node:** Node 1 is locked at `400`

**Execution Steps:**
1. **Pre-computation:**
   - Remaining Value = `1000 - 400` = **`600`**
   - Remaining Nodes = `4 - 1` = **`3`**
2. **Strategy Math:**
   - Base Value = `600 / 3` = **`200`**

**Output:**
| Node | isoverride | Initial Value | Calculated Value |
|---|---|---|---|
| Node 1 | `true` | 400 | **400** (Skipped) |
| Node 2 | `false` | 0 | **200** |
| Node 3 | `false` | 0 | **200** |
| Node 4 | `false` | 0 | **200** |

---

## 3. Strategy: WEIGHTED
Distributes the remaining value proportionally based on a `basis_measure` (e.g., historical sales, gross margin).

### Formula
```text
Total Basis = Sum of (basis_measure) across all Remaining Nodes
Node Weight = Node's basis_measure / Total Basis
Allocated Value = Node Weight * Remaining Value
```
*(Note: If a node's basis measure is missing/null, it defaults to `1` to prevent divide-by-zero errors).*

### Sample Scenario
- **Target Value:** 2,500
- **Measure:** `planned_sales`
- **Basis Measure:** `gross_sales`
- **Total Nodes:** 3
- **Override Node:** None

**Initial State:**
Node 1 `gross_sales` = 200
Node 2 `gross_sales` = 500
Node 3 `gross_sales` = 300

**Execution Steps:**
1. **Pre-computation:**
   - Remaining Value = **`2500`**
   - Total Basis = `200 + 500 + 300` = **`1000`**
2. **Strategy Math:**
   - Node 1: `(200 / 1000) * 2500` = **`500`**
   - Node 2: `(500 / 1000) * 2500` = **`1250`**
   - Node 3: `(300 / 1000) * 2500` = **`750`**

**Output:**
| Node | isoverride | basis (gross_sales) | Calculated Value |
|---|---|---|---|
| Node 1 | `false` | 200 | **500** |
| Node 2 | `false` | 500 | **1250** |
| Node 3 | `false` | 300 | **750** |

---

## 4. Strategy: COPY
Broadcasts the exact target value directly to all unlocked leaf nodes. This is heavily used in scenario planning or price setting where a flat attribute applies everywhere.

### Formula
```text
Allocated Value = Target Value
```

### Sample Scenario
- **Target Value:** 99.99
- **Measure:** `unit_price`
- **Total Nodes:** 3
- **Override Node:** Node 1 is locked at `120.00`

**Output:**
| Node | isoverride | Initial Value | Calculated Value |
|---|---|---|---|
| Node 1 | `true` | 120.00 | **120.00** (Skipped) |
| Node 2 | `false` | 0 | **99.99** |
| Node 3 | `false` | 0 | **99.99** |

---

## 5. Strategy: CUSTOM (Plugin Logic)
Because of the Engine's plugin architecture, developers can write their own complex algorithms. The currently registered `CUSTOM` strategy applies an equal split with an artificial 10% inflation bonus.

### Formula
```text
Base Value = Remaining Value / Remaining Nodes
Allocated Value = Base Value * 1.10
```

### Sample Scenario
- **Target Value:** 1,000
- **Measure:** `planned_sales`
- **Total Nodes:** 2
- **Override Node:** None

**Execution Steps:**
1. **Pre-computation:**
   - Remaining Value = **`1000`**
   - Remaining Nodes = **`2`**
2. **Strategy Math:**
   - Base Value = `1000 / 2` = `500`
   - Node Allocation = `500 * 1.10` = **`550`**

**Output:**
| Node | isoverride | Initial Value | Calculated Value |
|---|---|---|---|
| Node 1 | `false` | 0 | **550** |
| Node 2 | `false` | 0 | **550** |

*(Note: The sum of the allocated values equals 1,100, which is intentionally 110% of the target value based on the custom plugin logic).*

---

## 6. Post-computation (Constraints)
After **any** strategy executes, the engine runs an incredibly fast array mutation loop to enforce safety constraints defined by the OpenL Rule Engine.

**Example Constraints:**
1. **`MIN_ZERO`:** 
   `value = Math.max(0, value)`
   *(Converts any negative mathematical results, like `-50`, to `0`)*
2. **`ROUND_OFF`:** 
   `value = Math.round(value * 1000) / 1000`
   *(Forces strict 3-decimal precision, preventing floating-point drift like `10.000000000001`)*
