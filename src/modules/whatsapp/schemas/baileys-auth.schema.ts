import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class BaileysAuth extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true })
  tenantId: Types.ObjectId;

  @Prop({ required: true })
  sessionId: string;

  @Prop({ type: String, required: true })
  authData: string;
}

export const BaileysAuthSchema = SchemaFactory.createForClass(BaileysAuth);
