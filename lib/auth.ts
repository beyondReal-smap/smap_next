import jwt from 'jsonwebtoken';

export function verifyJWT(token: string) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET!);
  } catch (e) {
    return null;
  }
} 