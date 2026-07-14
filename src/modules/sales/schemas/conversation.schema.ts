import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ _id: false })
class MessageItem {
  @Prop({ enum: ['user', 'assistant', 'tool'], required: true })
  role: string;

  @Prop({ required: true })
  content: string;

  @Prop({ required: false })
  tool_call_id?: string;

  @Prop({ default: Date.now })
  timestamp: Date;
}

@Schema({ timestamps: true })
export class Conversation extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true })
  tenantId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Branch', required: false })
  branchId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Customer', required: true })
  customerId: Types.ObjectId;

  @Prop({ type: [MessageItem], default: [] })
  messages: MessageItem[];

  @Prop({ default: '' })
  summary: string;

  @Prop({ enum: ['ACTIVE', 'CLOSED', 'HUMAN_HANDOFF'], default: 'ACTIVE' })
  status: string;

  @Prop({ default: false })
  isAiPaused: boolean;

  @Prop({ type: [String], default: [] })
  processedMessageIds: string[];

  @Prop({ type: Object, default: {} })
  contextSummary: Record<string, any>;

  @Prop({ type: [Types.ObjectId], ref: 'Product', default: [] })
  lastSearchResults: Types.ObjectId[];
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);
