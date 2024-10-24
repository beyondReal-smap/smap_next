import type { NextApiRequest, NextApiResponse } from 'next';
import { verifyUser } from '../../../lib/auth';
import { sign } from 'jsonwebtoken';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { id, password } = req.body;
    const user = await verifyUser(id, password);
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    const token = sign(
      { userId: user.mt_idx },
      process.env.JWT_SECRET!,
      { expiresIn: '1d' }
    );
    
    res.status(200).json({
      token,
      user
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to login' });
  }
}