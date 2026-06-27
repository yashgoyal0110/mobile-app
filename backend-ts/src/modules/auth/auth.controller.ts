import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { AuthService } from './auth.service';
import { SendOtpDto, VerifyOtpDto } from './auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('send-otp')
  sendOtp(@Body() body: SendOtpDto) {
    return this.auth.sendOtp(body);
  }

  @Post('verify-otp')
  verifyOtp(@Body() body: VerifyOtpDto) {
    return this.auth.verifyOtp(body);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: any) {
    return this.auth.me(user);
  }
}
