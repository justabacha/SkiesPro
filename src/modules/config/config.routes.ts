import { Router, Request, Response } from 'express';
import { ConfigController } from './config.controller.js';

const router = Router();
const controller = new ConfigController();

router.get('/public', (req: Request, res: Response) => controller.getPublicConfig(req, res));

export default router;
