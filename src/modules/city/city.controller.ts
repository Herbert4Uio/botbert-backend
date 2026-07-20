import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { CityService } from './city.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';

@Controller('cities')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CityController {
  constructor(private readonly cityService: CityService) {}

  @Get()
  @Roles('OWNER', 'ADMIN', 'VIEWER')
  async findAll(@TenantId() tenantId: string) {
    return this.cityService.findAll(tenantId);
  }

  @Post()
  @Roles('OWNER', 'ADMIN')
  async create(@TenantId() tenantId: string, @Body() data: any) {
    return this.cityService.create(tenantId, data);
  }

  @Put(':id')
  @Roles('OWNER', 'ADMIN')
  async update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() data: any,
  ) {
    return this.cityService.update(tenantId, id, data);
  }

  @Delete(':id')
  @Roles('OWNER', 'ADMIN')
  async delete(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.cityService.delete(tenantId, id);
  }
}
