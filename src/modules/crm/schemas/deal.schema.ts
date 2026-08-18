import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Deal extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true })
  tenantId: Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop({ default: 0 })
  value: number;

  @Prop({ type: Types.ObjectId, ref: 'Pipeline', required: true })
  pipelineId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  stageId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Customer', required: true })
  customerId: Types.ObjectId;

  @Prop({ enum: ['OPEN', 'WON', 'LOST'], default: 'OPEN' })
  status: string;

  @Prop()
  expectedCloseDate: Date;

  @Prop()
  notes: string;
}

export const DealSchema = SchemaFactory.createForClass(Deal);
