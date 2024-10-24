import type { NextApiRequest, NextApiResponse } from 'next';
import { createUser } from '../../../lib/auth';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { id, password, name, email, phone, nickname } = req.body;
    
    const result = await createUser({
      id,
      password,
      name,
      email,
      phone,
      nickname
    });
    
    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to create user' });
  }
}