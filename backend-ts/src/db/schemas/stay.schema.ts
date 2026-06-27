import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({
  collection: 'stays',
  strict: false,
  minimize: false,
  versionKey: false,
})
export class Stay {
  @Prop({ index: true })
  id: string;

  @Prop()
  verified: boolean;

  @Prop()
  type: string;

  @Prop()
  area: string;

  [key: string]: any;
}

export const StaySchema = SchemaFactory.createForClass(Stay);
