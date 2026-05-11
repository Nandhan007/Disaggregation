import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { DBClient } from './db/mongoClient';
import { HierarchyResolver } from './services/hierarchyResolver';
import { OpenLClient } from './services/openLClient';
import { MathEngine } from './core/mathEngine';
import { Executor } from './core/executor';
import { DisaggInput } from './types';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Global logger to verify process activity
app.use((req, res, next) => {
  console.log(`>>> [Process ID: ${process.pid}] ${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'disagg_normalized_db';

const dbClient = new DBClient(MONGO_URI, DB_NAME);
const hierarchyResolver = new HierarchyResolver(dbClient);
const openLClient = new OpenLClient();
const mathEngine = new MathEngine();
const executor = new Executor(dbClient);

app.post('/api/disaggregate', async (req: Request, res: Response): Promise<void> => {
  console.log('[Server] Incoming request:', JSON.stringify(req.body));
  try {
    const input: DisaggInput = req.body;

    if (!input.targetValue || !input.target_measure || !input.dimensions?.time_id || !input.dimensions?.item_id) {
       console.error('[Server] Validation failed: Missing targetValue, target_measure, dimensions.time_id or dimensions.item_id');
       res.status(400).json({ error: 'Missing required input parameters: targetValue, target_measure, dimensions.time_id, dimensions.item_id' });
       return;
    }

    console.log(`[Server] Received disaggregation request for target: ${input.targetValue} on ${input.target_measure || 'planned_sales'}`);
    
    // 1. Fetch Strategy from OpenL
    const strategy = await openLClient.fetchStrategy(input);
    
    // 2. Resolve Hierarchy (Data-driven approach)
    const leafNodes = await hierarchyResolver.resolveToLeaves(input);
    
    // 3. Fetch Existing Data (to respect overrides and get current versions)
    const existingData = await dbClient.fetchExistingRecords(leafNodes);
    
    // 4. Compute Vectorized Math
    const computedData = mathEngine.compute(input, strategy, leafNodes, existingData);

    // 5. Execute in Chunks
    if (computedData.length > 0) {
      await executor.executeInChunks(computedData, 5000);
    }

    res.status(200).json({ 
      message: 'Disaggregation completed successfully',
      leavesProcessed: leafNodes.length,
      rowsUpdated: computedData.length
    });

  } catch (error: any) {
    console.error(`[Server] Error during disaggregation:`, error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
});

// Start Server
async function startServer() {
  await dbClient.connect();
  app.listen(PORT, () => {
    console.log(`Disaggregation Engine listening on port ${PORT}`);
  });
}

startServer().catch(console.error);
