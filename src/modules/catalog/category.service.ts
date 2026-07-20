import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Category } from './schemas/category.schema';

@Injectable()
export class CategoryService {
  constructor(
    @InjectModel(Category.name) private categoryModel: Model<Category>,
  ) {}

  async create(tenantId: string, data: any) {
    const created = new this.categoryModel({
      ...data,
      tenantId: new Types.ObjectId(tenantId),
    });
    return created.save();
  }

  async findAll(tenantId: string) {
    return this.categoryModel
      .find({ tenantId: new Types.ObjectId(tenantId) })
      .exec();
  }

  async findOne(tenantId: string, id: string) {
    const category = await this.categoryModel
      .findOne({
        _id: new Types.ObjectId(id),
        tenantId: new Types.ObjectId(tenantId),
      })
      .exec();
    if (!category) throw new NotFoundException('Categoría no encontrada');
    return category;
  }

  async update(tenantId: string, id: string, data: any) {
    const updated = await this.categoryModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id), tenantId: new Types.ObjectId(tenantId) },
        data,
        { new: true },
      )
      .exec();
    if (!updated) throw new NotFoundException('Categoría no encontrada');
    return updated;
  }

  async delete(tenantId: string, id: string) {
    const deleted = await this.categoryModel
      .findOneAndDelete({
        _id: new Types.ObjectId(id),
        tenantId: new Types.ObjectId(tenantId),
      })
      .exec();
    if (!deleted) throw new NotFoundException('Categoría no encontrada');
    return { message: 'Categoría eliminada con éxito' };
  }
}
