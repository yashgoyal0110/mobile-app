import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({
  collection: 'temples',
  strict: false,
  minimize: false,
  versionKey: false,
})
export class Temple {
  @Prop({ index: true })
  id: string;

  @Prop()
  verified: boolean;

  @Prop()
  area: string;

  [key: string]: any;
}

export const TempleSchema = SchemaFactory.createForClass(Temple);
