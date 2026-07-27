import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Product } from './schemas/product.schema';
import { Category } from './schemas/category.schema';

@Injectable()
export class ProductService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<Product>,
    @InjectModel(Category.name) private categoryModel: Model<Category>,
  ) {}

  async findAll(tenantId: string) {
    return this.productModel
      .find({ tenantId: new Types.ObjectId(tenantId) })
      .exec();
  }

  async findOne(tenantId: string, id: string) {
    return this.productModel
      .findOne({
        _id: new Types.ObjectId(id),
        tenantId: new Types.ObjectId(tenantId),
      })
      .exec();
  }

  async create(tenantId: string, data: any) {
    return this.productModel.create({
      ...data,
      tenantId: new Types.ObjectId(tenantId),
    });
  }

  async update(tenantId: string, id: string, data: any) {
    return this.productModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id), tenantId: new Types.ObjectId(tenantId) },
      data,
      { new: true },
    );
  }

  async delete(tenantId: string, id: string) {
    return this.productModel.findOneAndDelete({
      _id: new Types.ObjectId(id),
      tenantId: new Types.ObjectId(tenantId),
    });
  }

  async findByAttributes(
    tenantId: string,
    attributeFilters: Record<string, any>,
    categoryId?: string,
  ) {
    const filter: any = {
      tenantId: new Types.ObjectId(tenantId),
      isActive: true,
    };

    if (categoryId) {
      filter.categoryId = new Types.ObjectId(categoryId);
    }

    for (const [attrName, attrValue] of Object.entries(attributeFilters)) {
      if (attrValue === null || attrValue === undefined || attrValue === '') continue;

      if (typeof attrValue === 'object' && !Array.isArray(attrValue)) {
        if (attrValue.min !== undefined) {
          filter[`attributes.${attrName}`] = {
            ...filter[`attributes.${attrName}`],
            $gte: Number(attrValue.min),
          };
        }
        if (attrValue.max !== undefined) {
          filter[`attributes.${attrName}`] = {
            ...filter[`attributes.${attrName}`],
            $lte: Number(attrValue.max),
          };
        }
      } else if (Array.isArray(attrValue)) {
        filter[`attributes.${attrName}`] = { $in: attrValue };
      } else {
        filter[`attributes.${attrName}`] = String(attrValue);
      }
    }

    return this.productModel.find(filter).exec();
  }

  async findCategoriesWithAttributes(tenantId: string) {
    return this.categoryModel
      .find({
        tenantId: new Types.ObjectId(tenantId),
        isActive: true,
        'attributesSchema.0': { $exists: true },
      })
      .exec();
  }
}
