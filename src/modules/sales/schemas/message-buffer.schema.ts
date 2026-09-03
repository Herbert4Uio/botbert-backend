import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class MessageBuffer extends Document {
  @Prop({ type: Types.ObjectId, required: true, ref: 'Tenant' })
  tenantId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, ref: 'Conversation' })
  conversationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, ref: 'Customer' })
  customerId: Types.ObjectId;

  @Prop({ type: String, enum: ['BUFFERING', 'PROCESSING', 'COMPLETED', 'ERROR'], default: 'BUFFERING' })
  status: string;

  @Prop({ type: [{ messageId: String, text: String, timestamp: Date, raw: Object }], default: [] })
  messages: any[];

  @Prop({ type: Date, required: true })
  firstMessageAt: Date;

  @Prop({ type: Date, required: true })
  lastMessageAt: Date;

  @Prop({ type: Date, default: null })
  lockUntil: Date;
}

export const MessageBufferSchema = SchemaFactory.createForClass(MessageBuffer);
MessageBufferSchema.index({ conversationId: 1, status: 1 });
