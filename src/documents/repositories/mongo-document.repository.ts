import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DocumentEntity, NewDocument } from '../domain/document.entity.js';
import { DocumentRecord } from '../schemas/document-record.schema.js';
import { DocumentRepository } from './document.repository.js';

@Injectable()
export class MongoDocumentRepository extends DocumentRepository {
  constructor(
    @InjectModel(DocumentRecord.name)
    private readonly model: Model<DocumentRecord>,
  ) {
    super();
  }

  async create(document: NewDocument): Promise<DocumentEntity> {
    const { id, ...fields } = document;
    const created = await this.model.create({ _id: id, ...fields });
    return toEntity(created.toObject());
  }

  async findById(id: string): Promise<DocumentEntity | null> {
    const record = await this.model.findById(id).lean<DocumentRecord>().exec();
    return record ? toEntity(record) : null;
  }

  async findRecent(limit: number): Promise<DocumentEntity[]> {
    const records = await this.model
      .find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean<DocumentRecord[]>()
      .exec();
    return records.map(toEntity);
  }
}

function toEntity(record: DocumentRecord): DocumentEntity {
  const { _id, ...fields } = record;
  return { id: _id, ...fields };
}
