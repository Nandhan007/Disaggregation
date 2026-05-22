import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { DBClient } from './db/mongoClient';
import { HierarchyResolver } from './services/hierarchyResolver';
import { OpenLClient } from './services/openLClient';
import { MathEngine } from './core/mathEngine';
import { Executor } from './core/executor';
import { DisaggInput } from './types';
import { setupStrategies } from './plugins/register';
import { createDisaggregateRouter } from './routes/disaggregate';

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

// Initialize all strategies through the plugin registry
setupStrategies(mathEngine);

// Mount API Routes
const disaggregateRouter = createDisaggregateRouter(openLClient, hierarchyResolver, mathEngine, executor);
app.use('/api/disaggregate', disaggregateRouter);

// Start Server
async function startServer() {
  await dbClient.connect();
  app.listen(PORT, () => {
    console.log(`Disaggregation Engine listening on port ${PORT}`);
  });
}

startServer().catch(console.error);
