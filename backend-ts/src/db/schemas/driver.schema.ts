import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({
  collection: 'drivers',
  strict: false,
  minimize: false,
  versionKey: false,
})
export class Driver {
  @Prop({ type: String, index: true })
  id: string;

  @Prop({ type: String, index: true })
  user_id: string;

  @Prop({ type: String })
  kyc_status: string;

  @Prop({ type: Boolean })
  online: boolean;

  [key: string]: any;
}

export const DriverSchema = SchemaFactory.createForClass(Driver);
