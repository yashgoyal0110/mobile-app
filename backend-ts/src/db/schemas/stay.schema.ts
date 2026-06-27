import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({
  collection: 'stays',
  strict: false,
  minimize: false,
  versionKey: false,
})
export class Stay {
  @Prop({ type: String, index: true })
  id: string;

  @Prop({ type: Boolean })
  verified: boolean;

  @Prop({ type: String })
  type: string;

  @Prop({ type: String })
  area: string;

  [key: string]: any;
}

export const StaySchema = SchemaFactory.createForClass(Stay);
