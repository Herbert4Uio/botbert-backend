import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { VerticalConfig } from './schemas/vertical-config.schema';

@Injectable()
export class VerticalConfigService {
  constructor(
    @InjectModel(VerticalConfig.name)
    private verticalConfigModel: Model<VerticalConfig>,
  ) {}

  async findAll(tenantId: string) {
    return this.verticalConfigModel
      .find({ tenantId: new Types.ObjectId(tenantId) })
      .sort({ name: 1 })
      .exec();
  }

  async findOne(tenantId: string, id: string) {
    const config = await this.verticalConfigModel
      .findOne({
        _id: new Types.ObjectId(id),
        tenantId: new Types.ObjectId(tenantId),
      })
      .exec();
    if (!config) throw new NotFoundException('Configuración de vertical no encontrada');
    return config;
  }

  async findById(id: string) {
    return this.verticalConfigModel.findById(new Types.ObjectId(id)).exec();
  }

  async findByTenantAndName(tenantId: string, name: string) {
    return this.verticalConfigModel
      .findOne({
        tenantId: new Types.ObjectId(tenantId),
        name: { $regex: new RegExp(name, 'i') },
        isActive: true,
      })
      .exec();
  }

  async create(tenantId: string, data: any) {
    return this.verticalConfigModel.create({
      ...data,
      tenantId: new Types.ObjectId(tenantId),
    });
  }

  async update(tenantId: string, id: string, data: any) {
    const updated = await this.verticalConfigModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id), tenantId: new Types.ObjectId(tenantId) },
        data,
        { new: true },
      )
      .exec();
    if (!updated) throw new NotFoundException('Configuración de vertical no encontrada');
    return updated;
  }

  async delete(tenantId: string, id: string) {
    const deleted = await this.verticalConfigModel
      .findOneAndDelete({
        _id: new Types.ObjectId(id),
        tenantId: new Types.ObjectId(tenantId),
      })
      .exec();
    if (!deleted) throw new NotFoundException('Configuración de vertical no encontrada');
    return { message: 'Configuración de vertical eliminada' };
  }
}