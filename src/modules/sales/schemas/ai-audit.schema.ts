import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class AiAudit extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true })
  tenantId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Customer', required: true })
  customerId: Types.ObjectId;

  @Prop({ required: true })
  promptTokens: number;

  @Prop({ required: true })
  completionTokens: number;

  @Prop({ type: Object, required: true })
  requestPayload: Record<string, any>;

  @Prop({ type: Object, required: true })
  responsePayload: Record<string, any>;
}

export const AiAuditSchema = SchemaFactory.createForClass(AiAudit);
