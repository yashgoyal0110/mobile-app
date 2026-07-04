import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Restrict a handler to the given role(s). Mirrors Python `require_role(...)`.
 * Use together with `@UseGuards(AuthGuard)` — the guard reads this metadata.
 *   @Roles('driver')           // single role
 *   @Roles('passenger', 'admin')
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
