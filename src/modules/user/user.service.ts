import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './schemas/user.schema';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  async create(tenantId: string, createUserDto: any) {
    const saltOrRounds = 10;
    const hashedPassword = await bcrypt.hash(
      createUserDto.password,
      saltOrRounds,
    );

    return this.userModel.create({
      tenantId,
      ...createUserDto,
      hashedPassword,
    });
  }

  async findAll(tenantId: string) {
    return this.userModel.find({ tenantId }).select('-hashedPassword');
  }

  async findOne(tenantId: string, id: string) {
    const user = await this.userModel
      .findOne({ _id: id, tenantId })
      .select('-hashedPassword');
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  async update(tenantId: string, id: string, updateUserDto: any) {
    if (updateUserDto.password) {
      updateUserDto.hashedPassword = await bcrypt.hash(
        updateUserDto.password,
        10,
      );
      delete updateUserDto.password;
    }
    const user = await this.userModel
      .findOneAndUpdate({ _id: id, tenantId }, updateUserDto, { new: true })
      .select('-hashedPassword');
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  async remove(tenantId: string, id: string) {
    const user = await this.userModel.findOneAndDelete({ _id: id, tenantId });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }
}
