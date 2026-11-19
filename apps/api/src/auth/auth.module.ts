import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { SessionService } from './session.service';
import { AccessTokenService } from './access-token.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, SessionService, AccessTokenService],
  exports: [AuthService, AuthGuard, SessionService, AccessTokenService],
})
export class AuthModule {}
