import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({
  collection: 'prasad_orders',
  strict: false,
  minimize: false,
  versionKey: false,
})
export class PrasadOrder {
  @Prop({ type: String, index: true })
  id: string;

  @Prop({ type: String, index: true })
  user_id: string;

  @Prop({ type: String, index: true })
  temple_id: string;

  @Prop({ type: String })
  status: string;

  [key: string]: any;
}

export const PrasadOrderSchema = SchemaFactory.createForClass(PrasadOrder);
