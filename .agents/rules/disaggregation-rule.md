---
trigger: always_on
---

IMPORTANT:
- Do NOT suggest streaming or batch engines (Flink, Spark, Beam) for core disaggregation logic.
- Focus on OLTP, real-time, transactional computation.
- Emphasize vectorized, parallel, in-memory processing with bulk DB writes.
 
--------------------------------------------------
🎯 SYSTEM GOAL
--------------------------------------------------
 
Design a reusable disaggregation engine that:
- Accepts high-level user inputs (Year / Quarter / BU / Department)
- Expands into 50K–500K+ leaf-level rows (Month / Day / Item)
- Executes rule-driven allocation
- Persists results with strong consistency and high performance
 
The system must support:
✔ Real-time or near real-time execution (seconds)
✔ Multi-user concurrency
✔ Override handling (is_override flag)
✔ Idempotent updates
✔ High fan-out (1 → 50K+ rows)
 
--------------------------------------------------
🧠 CORE ARCHITECTURE PRINCIPLES
--------------------------------------------------
 
1. Separate responsibilities clearly:
   - Core Engine → computation + parallel execution
   - Rule Engine → decision only (no computation)
   - Database → storage + transactional consistency
 
2. Use:
   - Parallel chunk-based processing
   - Vectorized in-memory math (arrays, not row loops)
   - Bulk upsert (NOT row-by-row updates)
 
--------------------------------------------------
🧩 SYSTEM COMPONENTS
--------------------------------------------------
 
1. Planning Service (Core Engine)
   - Handles orchestration
   - Builds DisaggInput in memory
   - Executes parallel processing
   - Performs bulk DB writes
 
2. Rule Engine
   - Use OpenL Tablets
   - Returns:
     - Allocation method (EQUAL / WEIGHTED / COPY / CUSTOM)
     - Basis column
     - Constraints
 
3. OLTP Database (Mongodb recommended)
   - Stores fact data
   - Supports bulk upsert with conflict handling
 
4. CDC + Analytics (out of scope for logic)
   - DB → Kafka → Flink → Druid
 
--------------------------------------------------
📊 DATA MODEL
--------------------------------------------------
 
Fact Table:
sales_fact(
  item_id,
  time_id,
  location_id,
  scenario_id,
  planned_sales,
  is_override,
  updated_at
)
 
Composite Key:
(item_id, time_id, location_id, scenario_id)
 
--------------------------------------------------
🧠 DISAGGREGATION FLOW
--------------------------------------------------
 
1. Receive user update (parent level)
2. Fetch rule strategy from OpenL (single call)
3. Resolve hierarchy → get all leaf nodes
4. Fetch basis + override data (bulk)
5. Build DisaggInput (in-memory vector)
6. Apply vectorized computation:
   - Exclude overrides
   - Calculate total basis
   - Apply rule (equal / weighted / custom)
7. Split into chunks (e.g., 5K–10K rows)
8. Execute chunks in parallel (thread pool)
9. Perform bulk upsert per chunk
10. Ensure consistency and idempotency
 
--------------------------------------------------
⚙️ WHAT TO DESIGN
--------------------------------------------------
 
1. Parallel Disaggregation Engine
   - Chunking strategy (size, memory control)
   - Threading model (thread pool, parallel execution)
   - Handling 50K–500K rows efficiently
 
2. Vectorized Computation Model
   - Avoid per-row loops at DB level
   - Use arrays/lists for computation
   - Show formulas for:
     - Equal split
     - Weighted distribution
     - Override adjustment
 
3. OpenL Integration
   - Define datatable structure
   - Show how OpenL returns strategy (NOT SQL)
   - Explain how rules plug into engine
 
4. Bulk Upsert Strategy
   - PostgreSQL:
     INSERT ... ON CONFLICT DO UPDATE
   - Respect:
     - is_override
     - updated_at
   - Batch size recommendations
 
5. Concurrency Handling
   - Multiple users updating same hierarchy
   - Locking strategy:
     - Optimistic (versioning) OR
     - Pessimistic (parent-level lock)
   - Idempotent design
 
6. Failure Handling
   - Retry strategy (per chunk)
   - Transaction boundaries
   - Logging and traceability
 
7. Reusability Design (VERY IMPORTANT)
   - Make engine generic
   - Make domain logic configurable:
     - hierarchy
     - rules
     - metrics
   - Avoid hardcoding business logic
 
--------------------------------------------------
⚠️ CONSTRAINTS
--------------------------------------------------
 
- Do NOT:
  ❌ Use Flink/Spark/Beam for disaggregation logic
  ❌ Use row-by-row DB updates
  ❌ Call OpenL per row
  ❌ Push computation into DB
 
- MUST:
  ✅ Use in-memory vectorized processing
  ✅ Use bulk DB upsert
  ✅ Ensure transactional correctness
  ✅ Support high concurrency
