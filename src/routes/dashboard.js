import { Router } from 'express';
import { sendFrontend } from '../util/frontend.js';
export const dashboardRouter = Router();
dashboardRouter.get('/', (req, res, next) => {
  if (!req.user) return res.redirect('/?auth=required');
  return sendFrontend(req, res, next);
});
