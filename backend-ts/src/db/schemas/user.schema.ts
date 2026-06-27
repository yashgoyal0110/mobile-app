import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

/**
 * Users collection. Schemaless (`strict: false`) to mirror the Python backend,
 * which stored arbitrary fields (avg_rating, expo_push_token, ride_pin, ...).
 * The custom `id` (uuid) is the logical primary key — Mongo's `_id` is ignored
 * by the app and stripped on serialization (see common/utils.ts `clean`).
 */
@Schema({
  collection: 'users',
  strict: false,
  minimize: false,
  versionKey: false,
})
export class User {
  @Prop({ index: true })
  id: string;

  @Prop()
  phone: string;

  @Prop()
  role: string;

  [key: string]: any;
}

export const UserSchema = SchemaFactory.createForClass(User);
