/** Public fare configuration routes. Mirrors Python `app/routes/config.py`. */
import { Controller, Get } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { clean } from '../../common/utils';
import { FareConfig } from '../../db/schemas/fare-config.schema';

@Controller('config')
export class ConfigController {
  constructor(
    @InjectModel(FareConfig.name)
    private readonly fareConfigModel: Model<FareConfig>,
  ) {}

  @Get('fare')
  async getFareConfig() {
    const cfg = await this.fareConfigModel.findOne({ id: 'default' }).lean();
    return clean(cfg);
  }
}
