import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiHeader, ApiOperation } from '@nestjs/swagger';
import { ProductService } from './product.service';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Catalog')
@ApiHeader({ name: 'x-tenant-id', required: true })
@Controller('catalog/products')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Post()
  @ApiOperation({ summary: 'Crear producto' })
  @Roles('OWNER', 'ADMIN')
  async create(@TenantId() tenantId: string, @Body() createProductDto: any) {
    return this.productService.create(tenantId, createProductDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar productos' })
  @Roles('OWNER', 'ADMIN', 'VIEWER')
  async findAll(@TenantId() tenantId: string) {
    return this.productService.findAll(tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un producto' })
  @Roles('OWNER', 'ADMIN', 'VIEWER')
  async findOne(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.productService.findOne(tenantId, id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Editar producto' })
  @Roles('OWNER', 'ADMIN')
  async update(@TenantId() tenantId: string, @Param('id') id: string, @Body() updateProductDto: any) {
    return this.productService.update(tenantId, id, updateProductDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un producto' })
  @Roles('OWNER', 'ADMIN')
  async remove(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.productService.delete(tenantId, id);
  }
}
