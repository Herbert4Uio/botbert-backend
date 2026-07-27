import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Playbook } from './schemas/playbook.schema';
import { PlaybookRegistry } from './playbook-registry';

@Injectable()
export class PlaybookService {
  private readonly logger = new Logger(PlaybookService.name);

  constructor(
    @InjectModel(Playbook.name)
    private playbookModel: Model<Playbook>,
    private readonly playbookRegistry: PlaybookRegistry,
  ) {}

  async findAll(tenantId: string) {
    return this.playbookModel
      .find({ tenantId: new Types.ObjectId(tenantId) })
      .sort({ isDefault: -1, name: 1 })
      .exec();
  }

  async findOne(tenantId: string, id: string) {
    const playbook = await this.playbookModel
      .findOne({
        _id: new Types.ObjectId(id),
        tenantId: new Types.ObjectId(tenantId),
      })
      .exec();
    if (!playbook) throw new NotFoundException('Playbook no encontrado');
    return playbook;
  }

  async findActiveForTenant(tenantId: string) {
    return this.playbookModel
      .findOne({
        tenantId: new Types.ObjectId(tenantId),
        isActive: true,
      })
      .sort({ isDefault: -1 })
      .exec();
  }

  async create(tenantId: string, data: any) {
    if (data.isDefault) {
      await this.playbookModel.updateMany(
        { tenantId: new Types.ObjectId(tenantId), isDefault: true },
        { isDefault: false },
      );
    }

    if (!data.phases?.length) {
      const template = PlaybookRegistry.createForVertical(
        data.verticalType || 'general',
        tenantId,
      );
      data.phases = template.phases;
    }

    return this.playbookModel.create({
      ...data,
      tenantId: new Types.ObjectId(tenantId),
    });
  }

  async update(tenantId: string, id: string, data: any) {
    if (data.isDefault) {
      await this.playbookModel.updateMany(
        {
          tenantId: new Types.ObjectId(tenantId),
          isDefault: true,
          _id: { $ne: new Types.ObjectId(id) },
        },
        { isDefault: false },
      );
    }

    const updated = await this.playbookModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id), tenantId: new Types.ObjectId(tenantId) },
        data,
        { new: true },
      )
      .exec();
    if (!updated) throw new NotFoundException('Playbook no encontrado');
    return updated;
  }

  async delete(tenantId: string, id: string) {
    const deleted = await this.playbookModel
      .findOneAndDelete({
        _id: new Types.ObjectId(id),
        tenantId: new Types.ObjectId(tenantId),
      })
      .exec();
    if (!deleted) throw new NotFoundException('Playbook no encontrado');
    return { message: 'Playbook eliminado' };
  }

  async addPhase(tenantId: string, playbookId: string, phase: any) {
    const playbook = await this.findOne(tenantId, playbookId);

    const maxOrder = playbook.phases.reduce(
      (max, p) => Math.max(max, p.order),
      -1,
    );

    const newPhase = {
      ...phase,
      id: phase.id || `phase_${Date.now()}`,
      order: phase.order ?? maxOrder + 1,
    };

    playbook.phases.push(newPhase as any);
    playbook.phases.sort((a: any, b: any) => a.order - b.order);

    return playbook.save();
  }

  async updatePhase(
    tenantId: string,
    playbookId: string,
    phaseId: string,
    data: any,
  ) {
    const playbook = await this.findOne(tenantId, playbookId);

    const phaseIndex = playbook.phases.findIndex(
      (p: any) => p.id === phaseId,
    );
    if (phaseIndex === -1) {
      throw new NotFoundException(`Fase "${phaseId}" no encontrada en el playbook`);
    }

    playbook.phases[phaseIndex] = {
      ...playbook.phases[phaseIndex],
      ...data,
    } as any;

    return playbook.save();
  }

  async deletePhase(tenantId: string, playbookId: string, phaseId: string) {
    const playbook = await this.findOne(tenantId, playbookId);

    playbook.phases = playbook.phases.filter((p: any) => p.id !== phaseId);

    return playbook.save();
  }

  async createFromTemplate(tenantId: string, verticalType: string, name?: string) {
    const template = PlaybookRegistry.createForVertical(verticalType, tenantId);

    return this.create(tenantId, {
      ...template,
      name: name || template.name,
      verticalType,
    });
  }

  async duplicate(tenantId: string, sourceId: string, newName: string) {
    const source = await this.findOne(tenantId, sourceId);

    const duplicateData = source.toObject() as any;
    const { _id, createdAt, updatedAt, ...rest } = duplicateData;

    return this.create(tenantId, {
      ...rest,
      name: newName,
      isDefault: false,
    });
  }

  async togglePhase(
    tenantId: string,
    playbookId: string,
    phaseId: string,
    enabled: boolean,
  ) {
    const playbook = await this.findOne(tenantId, playbookId);

    const phase = playbook.phases.find((p: any) => p.id === phaseId);
    if (!phase) {
      throw new NotFoundException(`Fase "${phaseId}" no encontrada`);
    }

    (phase as any).enabled = enabled;
    return playbook.save();
  }
}
