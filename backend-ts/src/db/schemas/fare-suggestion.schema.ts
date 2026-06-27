import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({
  collection: 'fare_suggestions',
  strict: false,
  minimize: false,
  versionKey: false,
})
export class FareSuggestion {
  @Prop({ type: String, index: true })
  id: string;

  [key: string]: any;
}

export const FareSuggestionSchema =
  SchemaFactory.createForClass(FareSuggestion);
