import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  CONVERSATION_TITLE_LENGTH,
  MAX_CONVERSATION_MESSAGES,
  MAX_HISTORY_MESSAGES,
} from './conversations.constants.js';
import { ConversationsService } from './conversations.service.js';
import {
  COLLECTION_SCOPE,
  documentScope,
} from './domain/conversation-scope.js';
import {
  ConversationEntity,
  NewConversation,
} from './domain/conversation.entity.js';
import { ConversationRepository } from './repositories/conversation.repository.js';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const NOW = new Date('2026-10-26T15:00:00.000Z');

function buildConversation(
  overrides: Partial<ConversationEntity> = {},
): ConversationEntity {
  return {
    id: 'conv-1',
    scope: documentScope('doc-1'),
    title: '¿Quién es el proveedor?',
    messageCount: 2,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe('ConversationsService', () => {
  let repository: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    listByScope: ReturnType<typeof vi.fn>;
    findRecentMessages: ReturnType<typeof vi.fn>;
    findAllMessages: ReturnType<typeof vi.fn>;
    appendMessages: ReturnType<typeof vi.fn>;
  };
  let service: ConversationsService;

  beforeEach(() => {
    repository = {
      create: vi.fn((conversation: NewConversation) =>
        Promise.resolve(
          buildConversation({ ...conversation, messageCount: 0 }),
        ),
      ),
      findById: vi.fn().mockResolvedValue(buildConversation()),
      listByScope: vi.fn().mockResolvedValue([]),
      findRecentMessages: vi.fn().mockResolvedValue([]),
      findAllMessages: vi.fn().mockResolvedValue([]),
      appendMessages: vi.fn().mockResolvedValue(undefined),
    };
    service = new ConversationsService(
      repository as unknown as ConversationRepository,
    );
  });

  describe('openForQuestion', () => {
    it('creates a conversation titled with the question when no id is given', async () => {
      const conversation = await service.openForQuestion(
        COLLECTION_SCOPE,
        '¿Cuánto suman las facturas?',
      );

      expect(conversation.id).toMatch(UUID_PATTERN);
      expect(repository.create).toHaveBeenCalledWith({
        id: conversation.id,
        scope: COLLECTION_SCOPE,
        title: '¿Cuánto suman las facturas?',
      });
    });

    it('cuts long questions to the title length', async () => {
      await service.openForQuestion(COLLECTION_SCOPE, 'x'.repeat(500));

      const [created] = repository.create.mock.calls[0] as [NewConversation];
      expect(created.title).toHaveLength(CONVERSATION_TITLE_LENGTH);
    });

    it('returns the existing conversation of the same scope', async () => {
      await expect(
        service.openForQuestion(
          documentScope('doc-1'),
          'Y el total?',
          'conv-1',
        ),
      ).resolves.toEqual(buildConversation());
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the conversation does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.openForQuestion(COLLECTION_SCOPE, 'Hola', 'conv-9'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws BadRequestException when the conversation has another scope', async () => {
      await expect(
        service.openForQuestion(documentScope('doc-2'), 'Hola', 'conv-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.openForQuestion(COLLECTION_SCOPE, 'Hola', 'conv-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws ConflictException when the conversation is full', async () => {
      repository.findById.mockResolvedValue(
        buildConversation({ messageCount: MAX_CONVERSATION_MESSAGES }),
      );

      await expect(
        service.openForQuestion(documentScope('doc-1'), 'Hola', 'conv-1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  it('reads at most MAX_HISTORY_MESSAGES recent messages', async () => {
    await service.recentMessages('conv-1');

    expect(repository.findRecentMessages).toHaveBeenCalledWith(
      'conv-1',
      MAX_HISTORY_MESSAGES,
    );
  });

  it('stores the question and the answer as two messages', async () => {
    const answeredAt = new Date('2026-10-26T15:00:05.000Z');

    await service.appendExchange('conv-1', {
      question: '¿Total?',
      answer: '119.000 COP',
      askedAt: NOW,
      answeredAt,
    });

    expect(repository.appendMessages).toHaveBeenCalledWith('conv-1', [
      { role: 'user', text: '¿Total?', createdAt: NOW },
      { role: 'assistant', text: '119.000 COP', createdAt: answeredAt },
    ]);
  });

  it('returns a conversation with its messages', async () => {
    const messages = [{ role: 'user', text: '¿Total?', createdAt: NOW }];
    repository.findAllMessages.mockResolvedValue(messages);

    await expect(service.findWithMessages('conv-1')).resolves.toEqual({
      conversation: buildConversation(),
      messages,
    });
  });

  it('throws NotFoundException when reading a missing conversation', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(service.findWithMessages('conv-9')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
