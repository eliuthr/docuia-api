import {
  Controller,
  Get,
  MessageEvent,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Sse,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiPayloadTooLargeResponse,
  ApiProduces,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { documentFileValidationPipe } from './pipes/document-file-validation.pipe.js';
import { UPLOAD_FIELD_NAME } from './documents.constants.js';
import { DocumentsService } from './documents.service.js';
import { DocumentResponseDto } from './dto/document-response.dto.js';
import { ListDocumentsQueryDto } from './dto/list-documents-query.dto.js';
import { UploadDocumentDto } from './dto/upload-document.dto.js';
import { DocumentStatusStreamService } from './events/document-status-stream.service.js';
import type { UploadedDocumentFile } from './domain/uploaded-document-file.js';

@ApiTags('documents')
@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly statusStream: DocumentStatusStreamService,
  ) {}

  @Post()
  @UseInterceptors(FileInterceptor(UPLOAD_FIELD_NAME))
  @ApiOperation({ summary: 'Upload a document for background processing' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadDocumentDto })
  @ApiCreatedResponse({ type: DocumentResponseDto })
  @ApiBadRequestResponse({ description: 'Missing file or unsupported type' })
  @ApiPayloadTooLargeResponse({ description: 'File exceeds the size limit' })
  @ApiServiceUnavailableResponse({
    description: 'The processing queue is unavailable; nothing was stored',
  })
  async upload(
    @UploadedFile(documentFileValidationPipe) file: UploadedDocumentFile,
  ): Promise<DocumentResponseDto> {
    const document = await this.documentsService.upload(file);
    return DocumentResponseDto.fromEntity(document);
  }

  @Get()
  @ApiOperation({ summary: 'List the most recent documents' })
  @ApiOkResponse({ type: [DocumentResponseDto] })
  @ApiBadRequestResponse({ description: 'Invalid limit' })
  async findRecent(
    @Query() query: ListDocumentsQueryDto,
  ): Promise<DocumentResponseDto[]> {
    const documents = await this.documentsService.findRecent(query.limit);
    return documents.map((document) =>
      DocumentResponseDto.fromEntity(document),
    );
  }

  // Va antes de `@Get(':id')`: si no, Express tomaría "events" como un id.
  @Sse('events')
  @ApiOperation({
    summary: 'Stream document status changes (Server-Sent Events)',
  })
  @ApiProduces('text/event-stream')
  @ApiOkResponse({
    description:
      'Events: `document.updated` ({ documentId, status }) when the worker changes a ' +
      'status, and `ping` ({}) periodically to keep the connection open.',
  })
  streamStatusEvents(): Observable<MessageEvent> {
    return this.statusStream.stream();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a document and its processing status' })
  @ApiOkResponse({ type: DocumentResponseDto })
  @ApiBadRequestResponse({ description: 'The id is not a valid UUID' })
  @ApiNotFoundResponse({ description: 'Document not found' })
  async findById(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<DocumentResponseDto> {
    const document = await this.documentsService.findById(id);
    return DocumentResponseDto.fromEntity(document);
  }
}
