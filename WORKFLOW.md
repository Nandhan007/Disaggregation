# Disaggregation Engine Workflow

This document explains the inch-by-inch working mechanism of the Disaggregation Engine, tracing the path from the initial user input to the final database output.

## 0. Initial Seeding (Pre-requisite)
Before the engine can process disaggregation requests, the system must be seeded with normalized dimension and fact data.

**Process:**
1. **Dimension Seeding**: `item` and `time` entities are generated and stored in their respective collections in `disagg_normalized_db`.
2. **Fact Normalization**: `fact_data` is created using foreign keys (`item_id`, `time_id`) referencing the dimension tables.
3. **Data Mapping**: Business attributes like `planned_sales` and `planned_margin` are established, and redundant identifiers (`location_id`, `scenario_id`) are completely removed.
4. **View Creation**: A MongoDB View `combined_fact_view` is created to join the fact table with item and time metadata for real-time analytics.

---

## 1. Input (The Request)
The engine is triggered via a `POST` request to the `/api/disaggregate` endpoint.

**Sample Request Payload:**
```json
{
  "targetValue": 5000000,
  "target_measure": "planned_sales",
  "dimensions": {
    "item_id": "BU1",
    "time_id": "2024"
  }
}
```

---

## 2. Working Mechanism (The Pipeline)

Once the request is received by the Express API (`server.ts`), it flows through a strict, multi-step pipeline:

### Step 2.1: Input Validation
The server verifies that the critical payload parameters (`targetValue`, `target_measure`, `dimensions.time_id`, `dimensions.item_id`) are present. If any are missing, it immediately rejects the request with a **400 Bad Request**.

### Step 2.2: Fetch Rule Strategy
The engine calls the **OpenL Tablets** API to determine the allocation logic.
- **Endpoint**: Configured via `OPENL_URL` in `.env`.
- **Request**: `{"targetMeasure": "planned_sales"}` (mandatory).
- **Strict Error Handling**:
  - Throws error if `target_measure` is missing.
  - Throws error if `OPENL_URL` is not defined.
  - Throws error if the API returns a non-OK status (e.g., 404, 500).
  - Throws error if the response is empty or malformed.
- **Response Mapping (Direct from API):**
  - `Allocation_method`: `WEIGHTED` -> Engine uses `WEIGHTED` logic.
  - `Allocation_method`: `COPY` -> Engine uses `COPY` logic.
  - `Allocation_method`: `EQUAL` -> Engine uses `EQUAL` split logic.
- **Constraints Handling:** The engine receives an array of strings (e.g., `["MIN_ZERO", "ROUND_OFF"]`) and applies them during computation.

### Step 2.3: Hierarchy Resolution
**Component:** `HierarchyResolver`
The engine determines which granular leaf nodes already exist in the database for the given high-level input (e.g., "Year 2022" -> "Daily granularity for specific items").
- **Action:** Resolves dimension filters (BU, Dept, Time) and queries the `fact_data` collection to find existing records.
- **Result:** An array of `LeafNode` objects containing `(item_id, time_id)` for records that actually exist in the DB.

### Step 2.4: Fetch Existing State & Overrides
**Component:** `DBClient`
The engine checks the database for the current state of the resolved leaf nodes.
- **Action:** Queries the `fact_data` collection using `item_id` and `time_id`.
- **Purpose:** 
  1. To identify nodes with `is_override: true` (locked values).
  2. To fetch the current `version` for **Optimistic Locking**.

### Step 2.5: Vectorized Computation (In-Memory Processing)
**Component:** `MathEngine`
Number crunching is performed using in-memory, array-based operations to ensure high throughput.
- **Action:** 
  1. Filters out overridden nodes.
  2. Calculates the allocation based on `spreading_type`:
     - **EQUAL**: Even split across non-overridden nodes.
     - **WEIGHTED**: Proportional split based on `basis_measure` (defaults to `target_measure`).
     - **COPY**: Broadcasts `targetValue` to all nodes (broadcasting/copying).
  3. Applies **Constraints**: Clamps values based on rules like `MIN_ZERO` or `ROUND_OFF` (3 decimal places).
  4. Constructs the final `SalesFact` objects.

### Step 2.6: Chunking & Parallel Execution (Worker Threads)
**Component:** `Executor`
To handle 100K+ records efficiently, the data is chunked and processed in parallel.
- **Action:** Splits the results into chunks (e.g., 5,000 records).
- **Parallelism**: Spawns **Worker Threads** for each chunk. Each thread uses its own database connection to perform the bulk upsert, maximizing CPU and I/O efficiency.
- **Observability**: Each worker logs its progress (start, DB connection, bulk upsert attempts) which is piped back to the main process terminal.

### Step 2.7: Transactional Bulk Upsert
**Component:** `DBClient`
The data is persisted back to MongoDB using `bulkWrite`.
- **Action:** Performs `updateOne` operations with `upsert: true`.
- **Optimization:** The update payload is carefully structured to exclude fields handled by the filter and the `$inc` operator, preventing version path conflicts during high-concurrency writes.
- **Consistency & Versioning:** Every successful update triggers an atomic `$inc: { version: 1 }`. 
  - If a record is new (upsert), it starts at version 1.
  - If a record exists, it increments by 1.
  - This allows the engine to support **Optimistic Concurrency Control** (OCC) by ensuring that multiple simultaneous updates can be detected or handled correctly in the future.

---

## 3. Output (The Response)
The engine returns a summary of the processing.

**Sample Response:**
```json
{
  "message": "Disaggregation completed successfully",
  "leavesProcessed": 100000,
  "rowsUpdated": 100000
}
```

---

## 4. Verification (Post-Execution)
To ensure data integrity:
- **Verification Script:** Run `npm run verify`.
- **Result:** Checks record counts, validates that redundant IDs are gone, and confirms the `combined_fact_view` join is functioning correctly.
