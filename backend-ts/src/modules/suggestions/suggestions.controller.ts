/** Fare suggestion routes (driver community + admin apply). Mirrors `suggestions.py`. */
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { Roles } from '../../common/roles.decorator';
import { clean, newId, now } from '../../common/utils';
import { FareSuggestion } from '../../db/schemas/fare-suggestion.schema';
import { SuggestFareDto, VoteDto } from './suggestions.dto';

@Controller('suggestions')
@UseGuards(AuthGuard)
export class SuggestionsController {
  constructor(
    @InjectModel(FareSuggestion.name)
    private readonly suggestionModel: Model<FareSuggestion>,
  ) {}

  @Post()
  @Roles('driver')
  async create(@Body() req: SuggestFareDto, @CurrentUser() user: any) {
    const s: any = {
      id: newId(),
      driver_id: user.id,
      driver_name: user.name || user.phone,
      ride_type: req.ride_type,
      amount: req.amount,
      note: req.note ?? null,
      votes_up: 0,
      votes_down: 0,
      voters: [],
      status: 'open',
      created_at: now(),
    };
    await this.suggestionModel.create(s);
    return clean(s);
  }

  @Get()
  async list(@CurrentUser() _user: any) {
    const s = await this.suggestionModel
      .find({ status: 'open' })
      .sort({ created_at: -1 })
      .limit(50)
      .lean();
    return { suggestions: (s as any[]).map((x) => clean(x)) };
  }

  @Post(':sid/vote')
  @Roles('driver')
  async vote(
    @Param('sid') sid: string,
    @Body() req: VoteDto,
    @CurrentUser() user: any,
  ) {
    const s = await this.suggestionModel.findOne({ id: sid }).lean();
    if (!s) throw new NotFoundException('Not found');
    if (((s as any).voters || []).includes(user.id)) {
      throw new BadRequestException('Already voted');
    }
    const inc =
      req.vote === 'up' ? { votes_up: 1 } : { votes_down: 1 };
    await this.suggestionModel.updateOne(
      { id: sid },
      { $inc: inc, $push: { voters: user.id } },
    );
    return { ok: true };
  }
}
