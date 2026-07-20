import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../user/schemas/user.schema';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    private jwtService: JwtService,
  ) {}

  async login(loginDto: any) {
    const user = await this.userModel
      .findOne({ username: loginDto.username, isActive: true })
      .populate('tenantId');
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const isMatch = await bcrypt.compare(
      loginDto.password,
      user.hashedPassword,
    );
    if (!isMatch) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const tenantInfo = user.tenantId as any;

    const payload = {
      sub: user._id,
      tenantId: tenantInfo?._id || null,
      sucursalId: user.sucursalId,
      role: user.role,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        tenantId: tenantInfo?._id || null,
        tenantName: tenantInfo?.name || null,
        sucursalId: user.sucursalId,
      },
    };
  }
}
