import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({
  collection: 'withdrawals',
  strict: false,
  minimize: false,
  versionKey: false,
})
export class Withdrawal {
  @Prop({ index: true })
  id: string;

  @Prop({ index: true })
  driver_id: string;

  [key: string]: any;
}

export const WithdrawalSchema = SchemaFactory.createForClass(Withdrawal);
