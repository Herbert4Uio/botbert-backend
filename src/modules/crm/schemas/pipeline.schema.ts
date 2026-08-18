import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema()
export class Stage {
  @Prop({ type: Types.ObjectId, default: () => new Types.ObjectId() })
  _id: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  order: number;

  @Prop({ default: '#9CA3AF' })
  color: string;
}

export const StageSchema = SchemaFactory.createForClass(Stage);

@Schema({ timestamps: true })
export class Pipeline extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true })
  tenantId: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop({ type: [StageSchema], default: [] })
  stages: Stage[];

  @Prop({ default: true })
  isActive: boolean;
}

export const PipelineSchema = SchemaFactory.createForClass(Pipeline);
