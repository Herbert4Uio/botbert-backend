import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiHeader, ApiOperation } from '@nestjs/swagger';
import { CategoryService } from './category.service';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Categories')
@ApiHeader({ name: 'x-tenant-id', required: true })
@Controller('catalog/categories')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Post()
  @ApiOperation({ summary: 'Crear categoría' })
  @Roles('OWNER', 'ADMIN')
  async create(@TenantId() tenantId: string, @Body() createCategoryDto: any) {
    return this.categoryService.create(tenantId, createCategoryDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar categorías' })
  @Roles('OWNER', 'ADMIN', 'VIEWER')
  async findAll(@TenantId() tenantId: string) {
    return this.categoryService.findAll(tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una categoría' })
  @Roles('OWNER', 'ADMIN', 'VIEWER')
  async findOne(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.categoryService.findOne(tenantId, id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Editar categoría' })
  @Roles('OWNER', 'ADMIN')
  async update(@TenantId() tenantId: string, @Param('id') id: string, @Body() updateCategoryDto: any) {
    return this.categoryService.update(tenantId, id, updateCategoryDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar categoría' })
  @Roles('OWNER', 'ADMIN')
  async remove(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.categoryService.delete(tenantId, id);
  }
}
