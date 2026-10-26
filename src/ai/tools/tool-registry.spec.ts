import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { LlmTool } from './llm-tool.js';
import { MAX_TOOL_OUTPUT_CHARS, ToolRegistry } from './tool-registry.js';

const inputSchema = z.object({ documentId: z.string() });

function buildTool(execute: LlmTool['execute']): LlmTool {
  return {
    name: 'get_document_details',
    description: 'Gets a document.',
    inputSchema,
    execute,
  };
}

describe('ToolRegistry', () => {
  let execute: ReturnType<typeof vi.fn>;
  let registry: ToolRegistry;

  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    execute = vi.fn().mockResolvedValue({ name: 'invoice.pdf' });
    registry = new ToolRegistry([buildTool(execute as LlmTool['execute'])]);
  });

  it('describes each tool with its JSON Schema', () => {
    expect(registry.definitions()).toEqual([
      {
        name: 'get_document_details',
        description: 'Gets a document.',
        parameters: {
          type: 'object',
          properties: { documentId: { type: 'string' } },
          required: ['documentId'],
          additionalProperties: false,
        },
      },
    ]);
  });

  it('describes only the requested tools when names are given', () => {
    expect(registry.definitions(['get_document_details'])).toHaveLength(1);
    expect(registry.definitions(['find_documents'])).toEqual([]);
    expect(registry.definitions([])).toEqual([]);
  });

  it('runs the tool with the validated input and returns JSON', async () => {
    await expect(
      registry.execute('get_document_details', '{"documentId":"doc-1"}'),
    ).resolves.toBe('{"name":"invoice.pdf"}');
    expect(execute).toHaveBeenCalledWith({ documentId: 'doc-1' });
  });

  it('reports an unknown tool to the model', async () => {
    await expect(registry.execute('delete_everything', '{}')).resolves.toBe(
      '{"error":"Unknown tool \\"delete_everything\\"."}',
    );
  });

  it('reports invalid arguments to the model without running the tool', async () => {
    const output = await registry.execute('get_document_details', '{"id":1}');

    expect(JSON.parse(output)).toEqual({
      error: expect.stringContaining('Invalid arguments') as unknown,
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it('treats arguments that are not JSON as invalid', async () => {
    const output = await registry.execute('get_document_details', '{oops');

    expect(output).toContain('Invalid arguments');
  });

  it('reports a failing tool without throwing', async () => {
    execute.mockRejectedValue(new Error('storage down'));

    const output = await registry.execute(
      'get_document_details',
      '{"documentId":"doc-1"}',
    );

    expect(JSON.parse(output)).toEqual({
      error: 'The tool failed. Try again or answer without it.',
    });
  });

  it('truncates long results', async () => {
    execute.mockResolvedValue({ text: 'x'.repeat(MAX_TOOL_OUTPUT_CHARS * 2) });

    const output = await registry.execute(
      'get_document_details',
      '{"documentId":"doc-1"}',
    );

    expect(output).toHaveLength(MAX_TOOL_OUTPUT_CHARS);
    expect(output.endsWith('…[truncated]')).toBe(true);
  });
});
