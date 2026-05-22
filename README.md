# Disaggregation Engine

A highly concurrent, high-throughput Node.js disaggregation engine utilizing MongoDB for OLTP operations, optimized with a normalized data schema.

## Architecture

### 1. Planning Service (Core Engine)
- Handles orchestration.
- Resolves hierarchy via `HierarchyResolver`.
- Fetches allocation strategy from OpenL Tablets via `OpenLClient`.
- Executes parallel processing and bulk DB writes.

### 2. Rule Engine (OpenL Tablets)
- Integrated via `OpenLClient`.
- Endpoint: `http://14.96.223.218:9007/MFP_Project-info/disaggregation-rules/getStrategyByTargetMeasure`
- Returns:
  - Allocation method (`EQUAL` / `WEIGHTED` / `COPY`)
  - Basis measure (e.g., `planned_sales`)
  - Versioning and rule metadata

---

## Data Model

### Hierarchical Fact Tables
The system supports multiple levels of granularity across various fact tables:

1. **fact_data**: Granular leaf-level data (Item Range + Day).
2. **sales_quarter_fact**: Aggregated quarterly data by Department.
3. **sales_month_fact**: Aggregated monthly data by Item Range.

Each fact table includes standard metadata:
- `version`: For optimistic concurrency control.
- `updated_at`: Last modification timestamp.
- `is_override`: Flag to lock records from disaggregation logic.

---

## API Usage

### 🚀 API Reference

#### POST `/api/disaggregate`
Distributes a target value across leaf nodes based on a rule-driven strategy.

**Payload:**
```json
{
  "targetValue": 2500000,
  "target_measure": "planned_sales",
  "data_source": "fact_data",
  "dimensions": {
    "BusinessUnit": "WOMENSWEAR",
    "Year": "2022"
  }
}
```

- `dimensions`: A dynamic object representing filters (e.g., `BusinessUnit`, `Year`, `Department`). These are passed directly to Druid.
- `target_measure`: **[MANDATORY]** The field to be updated (e.g., `planned_sales`).

---

### ⚙️ Core Components

1. **OpenLClient**: Communicates with the rule engine to fetch allocation strategies based on the `target_measure`. **Fails explicitly if `target_measure` is missing or `OPENL_URL` is not set.**
2. **HierarchyResolver**: Queries Apache Druid via a dynamic SQL `WHERE` clause to resolve high-level dimensions into leaf nodes, returning a list of `_id` strings.
3. **MathEngine**: Performs vectorized, in-memory computations. Maps strictly via `_id` with support for overrides and constraints (`MIN_ZERO`, `ROUND_OFF`).
4. **Executor**: Handles parallel processing and bulk DB writes using Node.js Worker Threads.

### 🔒 Versioning & Consistency

- **Optimistic Locking**: Every record in the `fact_data` collection has a `version` field.
- **Automatic Increment**: The engine uses MongoDB's `$inc` operator during bulk updates to increment the version number for every successful change. This ensures consistency and prevents lost updates.

### 🛠️ Key Rules & Constraints
- **Round Off**: All calculated values are rounded to 3 decimal places (Constraint: `ROUND_OFF`).
- **Min Zero**: Ensures no negative values are persisted (Constraint: `MIN_ZERO`).
- **Override Respect**: If `is_override` is true, the engine skips that node during allocation.

---

## Error Handling
- **Missing Configuration**: Throws an error if `OPENL_URL` is missing from `.env`.
- **Validation**: Returns HTTP 400 if `target_measure` or other required payload fields are missing.
- **Rule Failure**: Returns HTTP 500 if the Rule Engine is unreachable or returns invalid data.

---

## Running the Application
1. Install dependencies: `npm install`
2. Create a `.env` file in the root directory (see `.env.example`).
3. Start MongoDB locally (port 27017 by default).
4. Seed the database with initial records:
   ```bash
   npm run seed
   ```
5. Run the development server:
   ```bash
   npm start
   ```

## Running Tests
Unit tests cover the core vectorized math engine and OpenL integration.
```bash
npm test
```

## Data Verification
To verify the database state:
```bash
npm run verify
```
