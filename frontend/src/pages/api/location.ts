import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

const BACKEND_URL = 'http://backend:5000/api/v1/locations/';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      // 목록 조회
      const response = await axios.get(BACKEND_URL, {
        headers: { 'Content-Type': 'application/json' },
        params: req.query,
      });
      res.status(response.status).json(response.data);
    } else if (req.method === 'POST') {
      // 생성
      const response = await axios.post(BACKEND_URL, req.body, {
        headers: { 'Content-Type': 'application/json' },
      });
      res.status(response.status).json(response.data);
    } else {
      res.status(405).json({ error: 'Method Not Allowed' });
    }
  } catch (error: any) {
    res.status(error?.response?.status || 500).json({
      result: 'N',
      error: 'Internal server error',
      details: error?.response?.data || error.message,
    });
  }
} 