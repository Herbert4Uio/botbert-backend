import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Product } from './schemas/product.schema';

@Injectable()
export class ProductService {
  constructor(@InjectModel(Product.name) private productModel: Model<Product>) {}

  async findAll(tenantId: string) {
    return this.productModel.find({ tenantId: new Types.ObjectId(tenantId) }).exec();
  }

  async findOne(tenantId: string, id: string) {
    return this.productModel.findOne({ _id: new Types.ObjectId(id), tenantId: new Types.ObjectId(tenantId) }).exec();
  }

  async create(tenantId: string, data: any) {
    return this.productModel.create({ ...data, tenantId: new Types.ObjectId(tenantId) });
  }

  async update(tenantId: string, id: string, data: any) {
    return this.productModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id), tenantId: new Types.ObjectId(tenantId) },
      data,
      { new: true }
    );
  }

  async delete(tenantId: string, id: string) {
    return this.productModel.findOneAndDelete({ _id: new Types.ObjectId(id), tenantId: new Types.ObjectId(tenantId) });
  }
}
