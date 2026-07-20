import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { City } from './schemas/city.schema';

@Injectable()
export class CityService {
  constructor(@InjectModel(City.name) private cityModel: Model<City>) {}

  async findAll(tenantId: string) {
    return this.cityModel
      .find({ tenantId: new Types.ObjectId(tenantId) })
      .sort({ name: 1 })
      .exec();
  }

  async create(tenantId: string, data: any) {
    return this.cityModel.create({
      ...data,
      tenantId: new Types.ObjectId(tenantId),
    });
  }

  async update(tenantId: string, id: string, data: any) {
    const updated = await this.cityModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id), tenantId: new Types.ObjectId(tenantId) },
      data,
      { new: true },
    );
    if (!updated) throw new NotFoundException('Ciudad no encontrada');
    return updated;
  }

  async delete(tenantId: string, id: string) {
    const deleted = await this.cityModel.findOneAndDelete({
      _id: new Types.ObjectId(id),
      tenantId: new Types.ObjectId(tenantId),
    });
    if (!deleted) throw new NotFoundException('Ciudad no encontrada');
    return deleted;
  }
}
