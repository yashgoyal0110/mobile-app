import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({
  collection: 'complaints',
  strict: false,
  minimize: false,
  versionKey: false,
})
export class Complaint {
  @Prop({ index: true })
  id: string;

  @Prop()
  status: string;

  [key: string]: any;
}

export const ComplaintSchema = SchemaFactory.createForClass(Complaint);
