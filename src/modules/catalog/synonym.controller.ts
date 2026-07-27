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
import { SynonymService } from './synonym.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';

@Controller('synonym-dictionaries')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SynonymController {
  constructor(private readonly synonymService: SynonymService) {}

  @Get()
  @Roles('OWNER', 'ADMIN', 'VIEWER')
  async findAll(@TenantId() tenantId: string) {
    return this.synonymService.findAll(tenantId);
  }

  @Get(':id')
  @Roles('OWNER', 'ADMIN', 'VIEWER')
  async findOne(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.synonymService.findOne(tenantId, id);
  }

  @Post()
  @Roles('OWNER', 'ADMIN')
  async create(@TenantId() tenantId: string, @Body() data: any) {
    return this.synonymService.create(tenantId, data);
  }

  @Put(':id')
  @Roles('OWNER', 'ADMIN')
  async update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() data: any,
  ) {
    return this.synonymService.update(tenantId, id, data);
  }

  @Delete(':id')
  @Roles('OWNER', 'ADMIN')
  async delete(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.synonymService.delete(tenantId, id);
  }
}
