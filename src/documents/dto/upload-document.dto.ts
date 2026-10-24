import { ApiProperty } from '@nestjs/swagger';

/** Describes the multipart body for Swagger; the file itself is validated by a pipe. */
export class UploadDocumentDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'PDF, PNG or JPEG file',
  })
  file: unknown;
}
