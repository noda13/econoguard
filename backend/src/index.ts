import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import newsRoutes from './routes/news.js';
import risksRoutes from './routes/risks.js';
import indicatorsRoutes from './routes/indicators.js';
import adminRoutes from './routes/admin.js';
import { startScheduler } from './jobs/scheduler.js';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/news', newsRoutes);
app.use('/api/risks', risksRoutes);
app.use('/api/indicators', indicatorsRoutes);
app.use('/api/admin', adminRoutes);

const PORT = process.env.PORT || 8000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Econoguard server running on port ${PORT}`);
  startScheduler();
});
