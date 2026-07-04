import {
  Body,
  Controller,
  Logger,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { clean } from '../../common/utils';
import { User } from '../../db/schemas/user.schema';
import { PushTokenDto, UpdateUserDto } from './users.dto';

@Controller('users')
@UseGuards(AuthGuard)
export class UsersController {
  private readonly logger = new Logger('fifthdigit.users');

  constructor(@InjectModel(User.name) private readonly userModel: Model<User>) {}

  @Patch('me')
  async updateMe(@CurrentUser() user: any, @Body() req: UpdateUserDto) {
    const updates: Record<string, any> = {};
    for (const [k, v] of Object.entries(req)) {
      if (v !== undefined && v !== null) updates[k] = v;
    }
    if (Object.keys(updates).length > 0) {
      await this.userModel.updateOne({ id: user.id }, { $set: updates });
    }
    const fresh = await this.userModel.findOne({ id: user.id }).lean();
    return clean(fresh);
  }

  @Post('push-token')
  async registerPush(@CurrentUser() user: any, @Body() req: PushTokenDto) {
    await this.userModel.updateOne(
      { id: user.id },
      { $set: { expo_push_token: req.token, push_platform: req.platform } },
    );
    this.logger.debug(
      `Push token registered user=${user.id} platform=${req.platform}`,
    );
    return { ok: true };
  }
}
