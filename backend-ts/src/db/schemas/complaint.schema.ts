import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({
  collection: 'complaints',
  strict: false,
  minimize: false,
  versionKey: false,
})
export class Complaint {
  @Prop({ type: String, index: true })
  id: string;

  @Prop({ type: String })
  status: string;

  [key: string]: any;
}

export const ComplaintSchema = SchemaFactory.createForClass(Complaint);
