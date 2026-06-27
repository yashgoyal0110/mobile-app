import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({
  collection: 'rides',
  strict: false,
  minimize: false,
  versionKey: false,
})
export class Ride {
  @Prop({ index: true })
  id: string;

  @Prop({ index: true })
  passenger_id: string;

  @Prop({ index: true })
  driver_id: string | null;

  @Prop()
  status: string;

  [key: string]: any;
}

export const RideSchema = SchemaFactory.createForClass(Ride);
