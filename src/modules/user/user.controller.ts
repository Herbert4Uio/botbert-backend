import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @Roles('OWNER', 'ADMIN') // Solo los admin o dueños pueden crear usuarios
  async create(@TenantId() tenantId: string, @Body() createUserDto: any) {
    return this.userService.create(tenantId, createUserDto);
  }

  @Get()
  @Roles('OWNER', 'ADMIN')
  async findAll(@TenantId() tenantId: string) {
    return this.userService.findAll(tenantId);
  }

  @Get(':id')
  @Roles('OWNER', 'ADMIN')
  async findOne(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.userService.findOne(tenantId, id);
  }

  @Put(':id')
  @Roles('OWNER', 'ADMIN')
  async update(@TenantId() tenantId: string, @Param('id') id: string, @Body() updateUserDto: any) {
    return this.userService.update(tenantId, id, updateUserDto);
  }

  @Delete(':id')
  @Roles('OWNER') // Solo OWNER puede borrar usuarios
  async remove(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.userService.remove(tenantId, id);
  }
}
