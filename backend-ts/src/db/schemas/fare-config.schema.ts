import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({
  collection: 'fare_config',
  strict: false,
  minimize: false,
  versionKey: false,
})
export class FareConfig {
  @Prop({ index: true })
  id: string;

  [key: string]: any;
}

export const FareConfigSchema = SchemaFactory.createForClass(FareConfig);
