import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({
  collection: 'withdrawals',
  strict: false,
  minimize: false,
  versionKey: false,
})
export class Withdrawal {
  @Prop({ type: String, index: true })
  id: string;

  @Prop({ type: String, index: true })
  driver_id: string;

  [key: string]: any;
}

export const WithdrawalSchema = SchemaFactory.createForClass(Withdrawal);
