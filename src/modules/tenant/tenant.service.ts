import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Tenant } from './schemas/tenant.schema';
import { User } from '../user/schemas/user.schema';
import * as bcrypt from 'bcrypt';

@Injectable()
export class TenantService {
  constructor(
    @InjectModel(Tenant.name) private tenantModel: Model<Tenant>,
    @InjectModel(User.name) private userModel: Model<User>
  ) {}

  async findAll() {
    return this.tenantModel.find().exec();
  }

  async findOne(id: string) {
    return this.tenantModel.findById(id).exec();
  }

  async create(data: any) {
    // Check if the owner email is already taken across the entire system
    if (data.ownerEmail) {
      const existingUser = await this.userModel.findOne({ username: data.ownerEmail });
      if (existingUser) {
        throw new BadRequestException('El correo del propietario ya está registrado.');
      }
    }

    // Create the tenant
    const newTenant = new this.tenantModel({
      name: data.name,
      plan: data.plan,
      isActive: data.isActive ?? true,
    });
    const savedTenant = await newTenant.save();

    // Create the OWNER user if provided
    if (data.ownerEmail && data.ownerPassword && data.ownerName) {
      const hashedPassword = await bcrypt.hash(data.ownerPassword, 10);
      await this.userModel.create({
        tenantId: savedTenant._id,
        username: data.ownerEmail,
        hashedPassword,
        fullName: data.ownerName,
        role: 'OWNER',
        isActive: true,
      });
    }

    return savedTenant;
  }

  async update(id: string, data: any) {
    return this.tenantModel.findByIdAndUpdate(id, data, { new: true });
  }

  async remove(id: string) {
    return this.tenantModel.findByIdAndDelete(id);
  }
}
