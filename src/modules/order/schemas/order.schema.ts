import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ _id: false })
class OrderItem {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  productId: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  quantity: number;

  @Prop({ required: true })
  price: number;

  @Prop({ type: [String], default: [] })
  modifications: string[];
}

@Schema({ timestamps: true })
export class Order extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true })
  tenantId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Branch', required: false })
  branchId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Customer', required: true })
  customerId: Types.ObjectId;

  @Prop({ type: [OrderItem], required: true })
  items: OrderItem[];

  @Prop({ required: true })
  totalAmount: number;

  @Prop({ enum: ['QR', 'CASH', 'TRANSFER'] })
  paymentType: string;

  @Prop({ enum: ['PAY_NOW', 'PAY_LATER'] })
  paymentTiming: string;

  @Prop()
  billingName: string;

  @Prop()
  billingNit: string;

  @Prop({ enum: ['PICKUP', 'DELIVERY'] })
  deliveryType: string;

  @Prop()
  shippingDate: string;

  @Prop()
  shippingTimeRange: string;

  @Prop()
  shippingInstructions: string;

  @Prop()
  shippingAddress: string;

  @Prop({
    enum: [
      'PENDING',
      'WAITING_PAYMENT',
      'PAID',
      'PREPARING',
      'READY',
      'SHIPPED',
      'DELIVERED',
      'CANCELLED',
    ],
    default: 'PENDING',
  })
  status: string;

  @Prop({ default: false })
  isPaid: boolean;

  @Prop({ default: true })
  isAiGenerated: boolean;
}

export const OrderSchema = SchemaFactory.createForClass(Order);
