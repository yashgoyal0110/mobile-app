/**
 * Authentication + role guard. Combines Python's `get_current_user` and
 * `require_role(...)` dependencies into a single Nest guard.
 *
 * - Accepts the token from the standard `Authorization: Bearer <t>` header OR
 *   the custom `X-Auth-Token` header (some ingresses 307-redirect cross-origin
 *   and browsers strip Authorization on cross-origin redirects).
 * - Loads the user document and attaches it to `request.user`.
 * - If the handler carries `@Roles(...)` metadata, enforces it (403 otherwise).
 */
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from './jwt.service';
import { ROLES_KEY } from './roles.decorator';
import { User } from '../db/schemas/user.schema';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    let token: string | undefined;
    const authHeader: string | undefined =
      request.headers['authorization'] || request.headers['Authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice('Bearer '.length).trim();
    }
    if (!token) {
      token =
        request.headers['x-auth-token'] || request.headers['X-Auth-Token'];
    }
    if (!token) {
      throw new UnauthorizedException('Missing token');
    }

    const payload = this.jwt.verify(token);
    if (!payload) {
      throw new UnauthorizedException('Invalid token');
    }

    const user = await this.userModel.findOne({ id: payload.sub }).lean();
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    request.user = user;

    const roles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (roles && roles.length > 0 && !roles.includes(user.role)) {
      throw new ForbiddenException(`Requires role: ${roles.join(', ')}`);
    }

    return true;
  }
}
