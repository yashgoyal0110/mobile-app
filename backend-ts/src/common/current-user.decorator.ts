import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Injects the authenticated user document (plain object) attached to the
 * request by `AuthGuard`. Mirrors Python `user: dict = Depends(get_current_user)`.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
