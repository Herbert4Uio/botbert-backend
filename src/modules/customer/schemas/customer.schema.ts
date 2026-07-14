import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Customer extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true })
  tenantId: Types.ObjectId;

  @Prop({ required: true })
  whatsappId: string;

  @Prop()
  profileName: string;

  @Prop()
  fullName: string;

  @Prop()
  nit: string;

  @Prop()
  customName: string;

  @Prop()
  address: string;

  @Prop()
  preferences: string;
}

export const CustomerSchema = SchemaFactory.createForClass(Customer);
