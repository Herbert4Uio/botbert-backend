import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class User extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: false })
  tenantId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Branch', required: false })
  sucursalId?: Types.ObjectId;

  @Prop({ required: true, unique: true })
  username: string;

  @Prop({ required: true })
  hashedPassword: string;

  @Prop({ required: true })
  fullName: string;

  @Prop({ required: true, enum: ['SUPERADMIN', 'OWNER', 'ADMIN', 'VIEWER'] })
  role: string;

  @Prop({ default: true })
  isActive: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);
