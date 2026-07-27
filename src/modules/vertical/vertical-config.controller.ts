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
import { VerticalConfigService } from './vertical-config.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { GUARDRAIL_PRESETS, getPresetByName } from './guardrail-presets';
import { ContentValidatorService } from '../sales/content-validator.service';

@Controller('vertical-configs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VerticalConfigController {
  constructor(
    private readonly verticalConfigService: VerticalConfigService,
    private readonly contentValidatorService: ContentValidatorService,
  ) {}

  @Get()
  @Roles('OWNER', 'ADMIN', 'VIEWER')
  async findAll(@TenantId() tenantId: string) {
    return this.verticalConfigService.findAll(tenantId);
  }

  @Get(':id')
  @Roles('OWNER', 'ADMIN', 'VIEWER')
  async findOne(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.verticalConfigService.findOne(tenantId, id);
  }

  @Post()
  @Roles('OWNER', 'ADMIN')
  async create(@TenantId() tenantId: string, @Body() data: any) {
    return this.verticalConfigService.create(tenantId, data);
  }

  @Put(':id')
  @Roles('OWNER', 'ADMIN')
  async update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() data: any,
  ) {
    return this.verticalConfigService.update(tenantId, id, data);
  }

  @Delete(':id')
  @Roles('OWNER', 'ADMIN')
  async delete(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.verticalConfigService.delete(tenantId, id);
  }

  // ── Guardrails Endpoints ──

  @Get('guardrails/presets')
  @Roles('OWNER', 'ADMIN', 'VIEWER')
  async getGuardrailPresets() {
    return GUARDRAIL_PRESETS.map((p) => ({
      name: p.name,
      label: p.label,
      description: p.description,
    }));
  }

  @Get('guardrails/presets/:presetName')
  @Roles('OWNER', 'ADMIN', 'VIEWER')
  async getGuardrailPresetDetail(@Param('presetName') presetName: string) {
    const preset = getPresetByName(presetName);
    if (!preset) {
      return { error: 'Preset no encontrado', available: GUARDRAIL_PRESETS.map((p) => p.name) };
    }
    return preset;
  }

  @Put(':id/guardrails/apply-preset')
  @Roles('OWNER', 'ADMIN')
  async applyGuardrailPreset(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: { presetName: string },
  ) {
    const preset = getPresetByName(body.presetName);
    if (!preset) {
      return { error: 'Preset no encontrado' };
    }

    const updateData = {
      ...preset.config,
      activePreset: body.presetName,
    };

    return this.verticalConfigService.update(tenantId, id, updateData);
  }

  @Put(':id/guardrails/test')
  @Roles('OWNER', 'ADMIN')
  async testGuardrails(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: { response: string; phase?: string },
  ) {
    const config = await this.verticalConfigService.findOne(tenantId, id);

    const result = this.contentValidatorService.validate(body.response, config, {
      currentPhase: body.phase,
    });

    return {
      input: body.response,
      result: {
        isValid: result.isValid,
        action: result.action,
        violations: result.violations,
        sanitizedResponse: result.sanitizedResponse,
        appliedRules: result.appliedRules,
      },
    };
  }
}
