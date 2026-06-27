import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({
  collection: 'drivers',
  strict: false,
  minimize: false,
  versionKey: false,
})
export class Driver {
  @Prop({ index: true })
  id: string;

  @Prop({ index: true })
  user_id: string;

  @Prop()
  kyc_status: string;

  @Prop()
  online: boolean;

  [key: string]: any;
}

export const DriverSchema = SchemaFactory.createForClass(Driver);
