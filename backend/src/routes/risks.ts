import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { scoreToLevel, RISK_WEIGHTS } from '../schemas/api.js';

const router: Router = Router();

// GET /api/risks - Get latest risk assessments for all categories
router.get('/', async (_req, res) => {
  const categories = ['currency_finance', 'geopolitics_supply_chain', 'technology', 'social_policy'];

  const latestRisks = await Promise.all(
    categories.map((category) =>
      prisma.riskAssessment.findFirst({
        where: { category },
        orderBy: { assessedAt: 'desc' },
      })
    )
  );

  res.json(latestRisks.filter(Boolean));
});

// GET /api/risks/composite - Get composite (weighted average) risk index
router.get('/composite', async (_req, res) => {
  const categories = ['currency_finance', 'geopolitics_supply_chain', 'technology', 'social_policy'];

  const latestRisks = await Promise.all(
    categories.map((category) =>
      prisma.riskAssessment.findFirst({
        where: { category },
        orderBy: { assessedAt: 'desc' },
      })
    )
  );

  const validRisks = latestRisks.filter(Boolean);
  if (validRisks.length === 0) {
    res.json({ compositeScore: 0, level: 'low', breakdown: [] });
    return;
  }

  const compositeScore = Math.round(
    validRisks.reduce((sum, risk) => sum + (risk!.score * (RISK_WEIGHTS[risk!.category] || 0.25)), 0)
  );

  const level = scoreToLevel(compositeScore);

  res.json({
    compositeScore,
    level,
    breakdown: validRisks.map((r) => ({
      category: r!.category,
      score: r!.score,
      weight: RISK_WEIGHTS[r!.category] || 0.25,
    })),
  });
});

// GET /api/risks/:category - Get risk history for a category
router.get('/:category', async (req, res) => {
  const { category } = req.params;
  const days = Math.min(Math.max(parseInt(req.query.days as string) || 30, 1), 365);
  const since = new Date();
  since.setDate(since.getDate() - days);

  const history = await prisma.riskAssessment.findMany({
    where: {
      category,
      assessedAt: { gte: since },
    },
    orderBy: { assessedAt: 'asc' },
  });

  res.json(history);
});

export default router;
