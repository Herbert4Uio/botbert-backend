import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Branch extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true })
  tenantId: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop({ type: Types.ObjectId, ref: 'City', required: true })
  cityId: Types.ObjectId;

  @Prop({ required: true })
  address: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  isBusinessHoursEnabled: boolean;

  @Prop({ default: '09:00' })
  businessHoursStart: string;

  @Prop({ default: '18:00' })
  businessHoursEnd: string;

  @Prop({
    default:
      'Lo sentimos, en este momento nos encontramos fuera de nuestro horario de atención. Te responderemos a la brevedad posible.',
  })
  outOfHoursMessage: string;
}

export const BranchSchema = SchemaFactory.createForClass(Branch);
