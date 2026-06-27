import { Module } from '@nestjs/common';
import { SuggestionsController } from './suggestions.controller';

@Module({
  controllers: [SuggestionsController],
})
export class SuggestionsModule {}
