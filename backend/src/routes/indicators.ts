import { Router } from 'express';
import prisma from '../lib/prisma.js';

const router = Router();

// GET /api/indicators - Get latest value of each indicator
router.get('/', async (_req, res) => {
  const codes = ['VIX', 'USDJPY', 'US_CPI', 'US_FFR', 'GOLD', 'US10Y', 'BTC'];

  const latest = await Promise.all(
    codes.map((code) =>
      prisma.economicIndicator.findFirst({
        where: { code },
        orderBy: { recordedAt: 'desc' },
      })
    )
  );

  res.json(latest.filter(Boolean));
});

export default router;
