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
const DB_NAME = process.env.DB_NAME || 'disaggregation_db';

const dbClient = new DBClient(MONGO_URI, DB_NAME);
const hierarchyResolver = new HierarchyResolver();
const openLClient = new OpenLClient();
const mathEngine = new MathEngine();
const executor = new Executor(dbClient);

app.post('/api/disaggregate', async (req: Request, res: Response): Promise<void> => {
  console.log('[Server] Incoming request:', JSON.stringify(req.body));
  try {
    const input: DisaggInput = req.body;

    if (!input.targetValue || !input.target_measure || !input.data_source || !input.dimensions || Object.keys(input.dimensions).length === 0) {
       console.error('[Server] Validation failed: Missing targetValue, target_measure, data_source, or dimensions');
       res.status(400).json({ error: 'Missing required input parameters: targetValue, target_measure, data_source, dimensions' });
       return;
    }

    console.log(`[Server] Received disaggregation request for target: ${input.targetValue} on ${input.target_measure || 'planned_sales'}`);
    
    // 1. Fetch Strategy from OpenL
    const strategy = await openLClient.fetchStrategy(input);
    
    // 2. Resolve Hierarchy & Fetch required records from Druid
    const existingData = await hierarchyResolver.fetchTargetRecords(input, strategy);
    
    // 3. Compute Vectorized Math
    const computedData = mathEngine.compute(input, strategy, existingData);
    
    // 4. Save back to DB
    if (computedData.length > 0) {
      await executor.executeInChunks(computedData, input.data_source, input.target_measure);
    }

    res.status(200).json({ 
      message: 'Disaggregation completed successfully',
      leavesProcessed: existingData.length,
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
