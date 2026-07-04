/**
 * JWT helpers. Mirrors `make_token` / token decode in Python `app/deps.py`.
 * HS256, payload { sub, role, iat, exp } — identical claims so existing tokens
 * issued by either backend remain interchangeable.
 */
import { Injectable } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { JWT_ALG, JWT_EXPIRE_DAYS, JWT_SECRET } from '../config/constants';

export interface JwtPayload {
  sub: string;
  role: string;
  iat: number;
  exp: number;
}

@Injectable()
export class JwtService {
  makeToken(userId: string, role: string): string {
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + JWT_EXPIRE_DAYS * 24 * 60 * 60;
    return jwt.sign({ sub: userId, role, iat, exp }, JWT_SECRET, {
      algorithm: JWT_ALG,
    });
  }

  /** Returns the decoded payload, or null if invalid/expired. */
  verify(token: string): JwtPayload | null {
    try {
      return jwt.verify(token, JWT_SECRET, {
        algorithms: [JWT_ALG],
      }) as JwtPayload;
    } catch {
      return null;
    }
  }
}
