import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Tag } from './schemas/tag.schema';
import { Pipeline } from './schemas/pipeline.schema';
import { Deal } from './schemas/deal.schema';
import { Customer } from '../customer/schemas/customer.schema';

@Injectable()
export class CrmService {
  constructor(
    @InjectModel(Tag.name) private tagModel: Model<Tag>,
    @InjectModel(Pipeline.name) private pipelineModel: Model<Pipeline>,
    @InjectModel(Deal.name) private dealModel: Model<Deal>,
    @InjectModel(Customer.name) private customerModel: Model<Customer>,
  ) {}

  // --- DASHBOARD STATS ---
  async getDashboardStats(tenantId: string) {
    const tid = new Types.ObjectId(tenantId);
    
    // Total Customers
    const totalCustomers = await this.customerModel.countDocuments({ tenantId: tid });
    
    // Deals
    const deals = await this.dealModel.find({ tenantId: tid }).exec();
    const pipelines = await this.pipelineModel.find({ tenantId: tid }).exec();
    
    const defaultPipeline = pipelines[0];
    let lastStageId = null;
    if (defaultPipeline && defaultPipeline.stages && defaultPipeline.stages.length > 0) {
      // Asumimos que la última fase (por orden) es "Ganado"
      const sortedStages = [...defaultPipeline.stages].sort((a, b) => a.order - b.order);
      lastStageId = sortedStages[sortedStages.length - 1]._id.toString();
    }

    let totalDeals = deals.length;
    let pipelineValue = 0;
    let wonDeals = 0;
    
    const dealsByStage: Record<string, { count: number, value: number, name: string, color: string }> = {};
    
    // Inicializar mapa de stages
    if (defaultPipeline) {
      defaultPipeline.stages.forEach(stage => {
        dealsByStage[stage._id.toString()] = { count: 0, value: 0, name: stage.name, color: stage.color || '#ccc' };
      });
    }

    deals.forEach(deal => {
      pipelineValue += (deal.value || 0);
      const stageIdStr = deal.stageId?.toString();
      
      if (stageIdStr === lastStageId) {
        wonDeals++;
      }

      if (stageIdStr && dealsByStage[stageIdStr]) {
        dealsByStage[stageIdStr].count++;
        dealsByStage[stageIdStr].value += (deal.value || 0);
      }
    });

    return {
      totalCustomers,
      totalDeals,
      pipelineValue,
      wonDeals,
      stages: Object.values(dealsByStage)
    };
  }

  // --- TAGS ---
  async getTags(tenantId: string) {
    return this.tagModel.find({ tenantId: new Types.ObjectId(tenantId) }).exec();
  }

  async createTag(tenantId: string, data: any) {
    const newTag = new this.tagModel({
      ...data,
      tenantId: new Types.ObjectId(tenantId),
    });
    return newTag.save();
  }

  async deleteTag(tenantId: string, tagId: string) {
    return this.tagModel.findOneAndDelete({
      _id: new Types.ObjectId(tagId),
      tenantId: new Types.ObjectId(tenantId),
    }).exec();
  }

  // --- CUSTOMER TAGS ---
  async updateCustomerTags(tenantId: string, customerId: string, tagIds: string[]) {
    const objectIds = tagIds.map(id => new Types.ObjectId(id));
    const customer = await this.customerModel.findOneAndUpdate(
      { _id: new Types.ObjectId(customerId), tenantId: new Types.ObjectId(tenantId) },
      { $set: { tags: objectIds } },
      { new: true }
    ).populate('tags');
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  // --- CUSTOMERS ---
  async getCustomers(tenantId: string) {
    return this.customerModel.find({ tenantId: new Types.ObjectId(tenantId) })
      .populate('tags')
      .sort({ updatedAt: -1 })
      .exec();
  }

  async updateCustomer(tenantId: string, customerId: string, data: any) {
    const customer = await this.customerModel.findOneAndUpdate(
      { _id: new Types.ObjectId(customerId), tenantId: new Types.ObjectId(tenantId) },
      { $set: data },
      { new: true }
    ).populate('tags');
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  // --- PIPELINES ---
  async getPipelines(tenantId: string) {
    const pipelines = await this.pipelineModel.find({ tenantId: new Types.ObjectId(tenantId) }).exec();
    
    // Si no tiene pipeline, le creamos el embudo único por defecto
    if (pipelines.length === 0) {
      const defaultPipeline = new this.pipelineModel({
        tenantId: new Types.ObjectId(tenantId),
        name: 'Embudo de Ventas Principal',
        stages: [
          { name: 'Nuevo Lead', order: 1, color: '#3B82F6' },
          { name: 'Calificado', order: 2, color: '#8B5CF6' },
          { name: 'Presupuesto Enviado', order: 3, color: '#F59E0B' },
          { name: 'Negociación', order: 4, color: '#F97316' },
          { name: 'Ganado', order: 5, color: '#10B981' }
        ]
      });
      await defaultPipeline.save();
      return [defaultPipeline];
    }
    
    return pipelines;
  }

  async createPipeline(tenantId: string, data: any) {
    const newPipeline = new this.pipelineModel({
      ...data,
      tenantId: new Types.ObjectId(tenantId),
    });
    return newPipeline.save();
  }

  async updatePipeline(tenantId: string, pipelineId: string, data: any) {
    return this.pipelineModel.findOneAndUpdate(
      { _id: new Types.ObjectId(pipelineId), tenantId: new Types.ObjectId(tenantId) },
      { $set: data },
      { new: true }
    ).exec();
  }

  async deletePipeline(tenantId: string, pipelineId: string) {
    // Delete deals related to this pipeline? Or just prevent deletion.
    // For now, cascade delete deals
    await this.dealModel.deleteMany({
      pipelineId: new Types.ObjectId(pipelineId),
      tenantId: new Types.ObjectId(tenantId),
    });

    return this.pipelineModel.findOneAndDelete({
      _id: new Types.ObjectId(pipelineId),
      tenantId: new Types.ObjectId(tenantId),
    }).exec();
  }

  // --- DEALS ---
  async getDeals(tenantId: string, pipelineId: string) {
    return this.dealModel.find({
      tenantId: new Types.ObjectId(tenantId),
      pipelineId: new Types.ObjectId(pipelineId),
    }).populate('customerId').exec();
  }

  async createDeal(tenantId: string, data: any) {
    const newDeal = new this.dealModel({
      ...data,
      tenantId: new Types.ObjectId(tenantId),
      pipelineId: new Types.ObjectId(data.pipelineId),
      stageId: new Types.ObjectId(data.stageId),
      customerId: new Types.ObjectId(data.customerId),
    });
    return newDeal.save();
  }

  async updateDealStage(tenantId: string, dealId: string, newStageId: string) {
    return this.dealModel.findOneAndUpdate(
      { _id: new Types.ObjectId(dealId), tenantId: new Types.ObjectId(tenantId) },
      { $set: { stageId: new Types.ObjectId(newStageId) } },
      { new: true }
    ).exec();
  }

  async updateDeal(tenantId: string, dealId: string, data: any) {
    if (data.pipelineId) data.pipelineId = new Types.ObjectId(data.pipelineId);
    if (data.stageId) data.stageId = new Types.ObjectId(data.stageId);
    if (data.customerId) data.customerId = new Types.ObjectId(data.customerId);

    return this.dealModel.findOneAndUpdate(
      { _id: new Types.ObjectId(dealId), tenantId: new Types.ObjectId(tenantId) },
      { $set: data },
      { new: true }
    ).exec();
  }

  async deleteDeal(tenantId: string, dealId: string) {
    return this.dealModel.findOneAndDelete({
      _id: new Types.ObjectId(dealId),
      tenantId: new Types.ObjectId(tenantId),
    }).exec();
  }
}
