import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Customer } from './schemas/customer.schema';

@Injectable()
export class CustomerService {
  constructor(
    @InjectModel(Customer.name) private customerModel: Model<Customer>,
  ) {}

  async findAll(tenantId: string) {
    return this.customerModel
      .find({ tenantId: new Types.ObjectId(tenantId) })
      .exec();
  }
}
