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
import { PlaybookService } from './playbook.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { TenantId } from '../../../common/decorators/tenant.decorator';

@Controller('playbooks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PlaybookController {
  constructor(private readonly playbookService: PlaybookService) {}

  @Get()
  @Roles('OWNER', 'ADMIN', 'VIEWER')
  async findAll(@TenantId() tenantId: string) {
    return this.playbookService.findAll(tenantId);
  }

  @Get(':id')
  @Roles('OWNER', 'ADMIN', 'VIEWER')
  async findOne(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.playbookService.findOne(tenantId, id);
  }

  @Get('active/tenant')
  @Roles('OWNER', 'ADMIN', 'VIEWER')
  async findActive(@TenantId() tenantId: string) {
    return this.playbookService.findActiveForTenant(tenantId);
  }

  @Post()
  @Roles('OWNER', 'ADMIN')
  async create(@TenantId() tenantId: string, @Body() data: any) {
    return this.playbookService.create(tenantId, data);
  }

  @Post('from-template')
  @Roles('OWNER', 'ADMIN')
  async createFromTemplate(
    @TenantId() tenantId: string,
    @Body() body: { verticalType: string; name?: string },
  ) {
    return this.playbookService.createFromTemplate(
      tenantId,
      body.verticalType,
      body.name,
    );
  }

  @Post(':id/duplicate')
  @Roles('OWNER', 'ADMIN')
  async duplicate(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: { name: string },
  ) {
    return this.playbookService.duplicate(tenantId, id, body.name);
  }

  @Put(':id')
  @Roles('OWNER', 'ADMIN')
  async update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() data: any,
  ) {
    return this.playbookService.update(tenantId, id, data);
  }

  @Delete(':id')
  @Roles('OWNER', 'ADMIN')
  async delete(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.playbookService.delete(tenantId, id);
  }

  // ── Phase Management ──

  @Post(':id/phases')
  @Roles('OWNER', 'ADMIN')
  async addPhase(
    @TenantId() tenantId: string,
    @Param('id') playbookId: string,
    @Body() phase: any,
  ) {
    return this.playbookService.addPhase(tenantId, playbookId, phase);
  }

  @Put(':id/phases/:phaseId')
  @Roles('OWNER', 'ADMIN')
  async updatePhase(
    @TenantId() tenantId: string,
    @Param('id') playbookId: string,
    @Param('phaseId') phaseId: string,
    @Body() data: any,
  ) {
    return this.playbookService.updatePhase(tenantId, playbookId, phaseId, data);
  }

  @Delete(':id/phases/:phaseId')
  @Roles('OWNER', 'ADMIN')
  async deletePhase(
    @TenantId() tenantId: string,
    @Param('id') playbookId: string,
    @Param('phaseId') phaseId: string,
  ) {
    return this.playbookService.deletePhase(tenantId, playbookId, phaseId);
  }

  @Put(':id/phases/:phaseId/toggle')
  @Roles('OWNER', 'ADMIN')
  async togglePhase(
    @TenantId() tenantId: string,
    @Param('id') playbookId: string,
    @Param('phaseId') phaseId: string,
    @Body() body: { enabled: boolean },
  ) {
    return this.playbookService.togglePhase(
      tenantId,
      playbookId,
      phaseId,
      body.enabled,
    );
  }
}
