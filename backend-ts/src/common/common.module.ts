/**
 * Cross-cutting providers shared by every feature module: the JWT helper and
 * the auth/role guard. Exported so controllers can `@UseGuards(AuthGuard)`.
 */
import { Global, Module } from '@nestjs/common';
import { JwtService } from './jwt.service';
import { AuthGuard } from './auth.guard';

@Global()
@Module({
  providers: [JwtService, AuthGuard],
  exports: [JwtService, AuthGuard],
})
export class CommonModule {}
