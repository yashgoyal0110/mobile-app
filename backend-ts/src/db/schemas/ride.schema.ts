import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({
  collection: 'rides',
  strict: false,
  minimize: false,
  versionKey: false,
})
export class Ride {
  @Prop({ type: String, index: true })
  id: string;

  @Prop({ type: String, index: true })
  passenger_id: string;

  @Prop({ type: String, index: true })
  driver_id: string | null;

  @Prop({ type: String })
  status: string;

  [key: string]: any;
}

export const RideSchema = SchemaFactory.createForClass(Ride);
