import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({
  collection: 'temples',
  strict: false,
  minimize: false,
  versionKey: false,
})
export class Temple {
  @Prop({ type: String, index: true })
  id: string;

  @Prop({ type: Boolean })
  verified: boolean;

  @Prop({ type: String })
  area: string;

  [key: string]: any;
}

export const TempleSchema = SchemaFactory.createForClass(Temple);
