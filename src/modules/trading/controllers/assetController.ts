import { Request, Response } from 'express';
import { AssetService } from '../services/assetService.js';

const assetService = new AssetService();

export class AssetController {
  async listAssets(_req: Request, res: Response) {
    try {
      const assets = await assetService.listAssets();
      return res.json({
        status: 'success',
        data: assets,
      });
    } catch (error: any) {
      return res.status(500).json({
        status: 'error',
        message: error.message,
      });
    }
  }

  async getAssetDetail(req: Request, res: Response) {
    try {
      const { symbol } = req.params;
      const detail = await assetService.getAssetDetail(symbol);
      return res.json({
        status: 'success',
        data: detail,
      });
    } catch (error: any) {
      return res.status(404).json({
        status: 'error',
        message: error.message,
      });
    }
  }
}
