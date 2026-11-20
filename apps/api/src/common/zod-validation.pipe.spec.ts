import { BadRequestException } from '@nestjs/common';
import {
  createLinkedResourceSchema,
  createProjectLinkSchema,
  createTaskSchema,
  updateTaskSchema,
} from '@dotask/shared';
import { ZodValidationPipe } from './zod-validation.pipe';

describe('ZodValidationPipe', () => {
  it('aplica los valores por defecto del esquema', () => {
    const pipe = new ZodValidationPipe(createTaskSchema);
    expect(pipe.transform({ title: '  Comprar pan  ' })).toEqual({
      title: 'Comprar pan',
      status: 'not_started',
      importance: 'normal',
    });
  });

  it('rechaza campos desconocidos (asignación masiva)', () => {
    const pipe = new ZodValidationPipe(updateTaskSchema);
    expect(() => pipe.transform({ title: 'ok', createdAt: '2020-01-01T00:00:00Z' })).toThrow(
      BadRequestException,
    );
    expect(() => pipe.transform({ completedAt: '2020-01-01T00:00:00Z' })).toThrow(BadRequestException);
  });

  it('rechaza tipos incorrectos y título vacío', () => {
    const pipe = new ZodValidationPipe(createTaskSchema);
    expect(() => pipe.transform({ title: '' })).toThrow(BadRequestException);
    expect(() => pipe.transform({ title: 'x', importance: 'urgente' })).toThrow(BadRequestException);
    expect(() => pipe.transform({ title: 'x', assigneeId: 'no-es-uuid' })).toThrow(BadRequestException);
  });

  it('rechaza el estado "cancelada", que ya no existe', () => {
    const pipe = new ZodValidationPipe(updateTaskSchema);
    expect(() => pipe.transform({ status: 'cancelled' })).toThrow(BadRequestException);
  });

  it('valida la repetición y la zona horaria', () => {
    const pipe = new ZodValidationPipe(updateTaskSchema);
    expect(pipe.transform({ recurrence: { pattern: { type: 'daily' } }, timezone: 'America/Bogota' })).toEqual({
      recurrence: { pattern: { type: 'daily', interval: 1 }, range: { type: 'noEnd' } },
      timezone: 'America/Bogota',
    });
    expect(() => pipe.transform({ timezone: 'Marte/Olympus' })).toThrow(BadRequestException);
    expect(() =>
      pipe.transform({ recurrence: { pattern: { type: 'daily' }, range: { type: 'endDate' } } }),
    ).toThrow(BadRequestException);
  });

  it('solo vincula archivos de Google Drive y chats de claude.ai con su dominio', () => {
    const pipe = new ZodValidationPipe(createLinkedResourceSchema);
    expect(
      pipe.transform({
        applicationName: 'Google Drive',
        displayName: 'Informe',
        webUrl: 'https://docs.google.com/document/d/abc/edit',
      }),
    ).toBeTruthy();
    expect(() =>
      pipe.transform({ applicationName: 'Google Drive', displayName: 'x', webUrl: 'https://evil.example/drive' }),
    ).toThrow(BadRequestException);
    expect(() =>
      pipe.transform({ applicationName: 'Claude', displayName: 'x', webUrl: 'https://claude.ai.evil.com/chat/1' }),
    ).toThrow(BadRequestException);
    expect(() =>
      pipe.transform({ applicationName: 'Web', displayName: 'x', webUrl: 'http://inseguro.example' }),
    ).toThrow(BadRequestException);
  });

  it('rechaza un body ausente cuando hay campos obligatorios', () => {
    expect(() => new ZodValidationPipe(createTaskSchema).transform(undefined)).toThrow(
      BadRequestException,
    );
  });

  it('solo admite enlaces http(s) en proyectos', () => {
    const pipe = new ZodValidationPipe(createProjectLinkSchema);
    expect(pipe.transform({ label: 'Repo', url: 'https://github.com' })).toBeTruthy();
    expect(() => pipe.transform({ label: 'XSS', url: 'javascript:alert(1)' })).toThrow(
      BadRequestException,
    );
  });
});
