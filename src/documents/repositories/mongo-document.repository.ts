import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  DocumentChanges,
  DocumentEntity,
  NewDocument,
} from '../domain/document.entity.js';
import {
  DocumentPage,
  DocumentPageRequest,
  toDocumentPage,
} from '../domain/document-page.js';
import { DocumentSearchCriteria } from '../domain/document-search-criteria.js';
import { DocumentRecord } from '../schemas/document-record.schema.js';
import { DocumentRepository } from './document.repository.js';
import { buildCursorFilter, PAGE_SORT } from './mongo-cursor-filter.js';
import { buildSearchFilter } from './mongo-search-filter.js';

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

  async findPage(request: DocumentPageRequest): Promise<DocumentPage> {
    // Se pide uno de más para saber si existe una página siguiente.
    const records = await this.model
      .find(buildCursorFilter(request.after))
      .sort(PAGE_SORT)
      .limit(request.limit + 1)
      .lean<DocumentRecord[]>()
      .exec();
    return toDocumentPage(records.map(toEntity), request.limit);
  }

  async search(criteria: DocumentSearchCriteria): Promise<DocumentEntity[]> {
    const records = await this.model
      .find(buildSearchFilter(criteria))
      .sort({ createdAt: -1 })
      .limit(criteria.limit)
      .lean<DocumentRecord[]>()
      .exec();
    return records.map(toEntity);
  }

  async update(
    id: string,
    changes: DocumentChanges,
  ): Promise<DocumentEntity | null> {
    const record = await this.model
      .findByIdAndUpdate(id, { $set: changes }, { returnDocument: 'after' })
      .lean<DocumentRecord>()
      .exec();
    return record ? toEntity(record) : null;
  }

  async delete(id: string): Promise<void> {
    await this.model.deleteOne({ _id: id }).exec();
  }
}

/** Los registros creados antes de existir un campo llegan sin él, así que se usa null. */
function toEntity(record: DocumentRecord): DocumentEntity {
  const {
    _id,
    textStorageKey,
    pageCount,
    failureReason,
    documentType,
    summary,
    extractedData,
    ...fields
  } = record;
  return {
    id: _id,
    ...fields,
    textStorageKey: textStorageKey ?? null,
    pageCount: pageCount ?? null,
    failureReason: failureReason ?? null,
    documentType: documentType ?? null,
    summary: summary ?? null,
    extractedData: extractedData ?? null,
  };
}
