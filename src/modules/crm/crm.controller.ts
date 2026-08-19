import { Controller, Get, Post, Put, Patch, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { CrmService } from './crm.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER', 'ADMIN')
@Controller('crm')
export class CrmController {
  constructor(private readonly crmService: CrmService) {}

  // --- TAGS ---
  @Get('tags')
  getTags(@Request() req: any) {
    return this.crmService.getTags(req.user.tenantId);
  }

  @Post('tags')
  createTag(@Request() req: any, @Body() body: any) {
    return this.crmService.createTag(req.user.tenantId, body);
  }

  @Delete('tags/:id')
  deleteTag(@Request() req: any, @Param('id') id: string) {
    return this.crmService.deleteTag(req.user.tenantId, id);
  }

  // --- CUSTOMER TAGS ---
  @Patch('customers/:id/tags')
  updateCustomerTags(@Request() req: any, @Param('id') customerId: string, @Body() body: { tagIds: string[] }) {
    return this.crmService.updateCustomerTags(req.user.tenantId, customerId, body.tagIds);
  }

  @Get('customers')
  getCustomers(@Request() req: any) {
    return this.crmService.getCustomers(req.user.tenantId);
  }

  @Put('customers/:id')
  updateCustomer(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.crmService.updateCustomer(req.user.tenantId, id, body);
  }

  // --- PIPELINES ---
  @Get('pipelines')
  getPipelines(@Request() req: any) {
    return this.crmService.getPipelines(req.user.tenantId);
  }

  @Post('pipelines')
  createPipeline(@Request() req: any, @Body() body: any) {
    return this.crmService.createPipeline(req.user.tenantId, body);
  }

  @Put('pipelines/:id')
  updatePipeline(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.crmService.updatePipeline(req.user.tenantId, id, body);
  }

  @Delete('pipelines/:id')
  deletePipeline(@Request() req: any, @Param('id') id: string) {
    return this.crmService.deletePipeline(req.user.tenantId, id);
  }

  // --- DEALS ---
  @Get('pipelines/:pipelineId/deals')
  getDeals(@Request() req: any, @Param('pipelineId') pipelineId: string) {
    return this.crmService.getDeals(req.user.tenantId, pipelineId);
  }

  @Post('deals')
  createDeal(@Request() req: any, @Body() body: any) {
    return this.crmService.createDeal(req.user.tenantId, body);
  }

  @Patch('deals/:id/stage')
  updateDealStage(@Request() req: any, @Param('id') id: string, @Body() body: { stageId: string }) {
    return this.crmService.updateDealStage(req.user.tenantId, id, body.stageId);
  }

  @Put('deals/:id')
  updateDeal(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.crmService.updateDeal(req.user.tenantId, id, body);
  }

  @Delete('deals/:id')
  deleteDeal(@Request() req: any, @Param('id') id: string) {
    return this.crmService.deleteDeal(req.user.tenantId, id);
  }
}
