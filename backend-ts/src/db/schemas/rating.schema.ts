import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({
  collection: 'ratings',
  strict: false,
  minimize: false,
  versionKey: false,
})
export class Rating {
  @Prop({ type: String, index: true })
  id: string;

  @Prop({ type: String, index: true })
  ride_id: string;

  @Prop({ type: String, index: true })
  target_user_id: string;

  [key: string]: any;
}

export const RatingSchema = SchemaFactory.createForClass(Rating);
