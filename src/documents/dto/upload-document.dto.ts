import { ApiProperty } from '@nestjs/swagger';

/** Describe el cuerpo multipart para Swagger; el archivo en sí lo valida un pipe. */
export class UploadDocumentDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'PDF, PNG or JPEG file',
  })
  file: unknown;
}
