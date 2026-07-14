import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Branch } from './schemas/branch.schema';

@Injectable()
export class BranchService {
  constructor(@InjectModel(Branch.name) private branchModel: Model<Branch>) {}

  async findAll(tenantId: string) {
    return this.branchModel.find({ tenantId: new Types.ObjectId(tenantId) }).populate('cityId').exec();
  }

  async create(tenantId: string, data: any) {
    const newBranch = new this.branchModel({
      ...data,
      tenantId: new Types.ObjectId(tenantId),
      cityId: data.cityId ? new Types.ObjectId(data.cityId) : null,
    });
    return newBranch.save();
  }

  async update(tenantId: string, id: string, data: any) {
    const payload = { ...data };
    if (payload.cityId) {
      payload.cityId = new Types.ObjectId(payload.cityId);
    }
    return this.branchModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id), tenantId: new Types.ObjectId(tenantId) },
      payload,
      { new: true }
    );
  }

  async remove(tenantId: string, id: string) {
    return this.branchModel.findOneAndDelete({
      _id: new Types.ObjectId(id),
      tenantId: new Types.ObjectId(tenantId)
    });
  }
}
