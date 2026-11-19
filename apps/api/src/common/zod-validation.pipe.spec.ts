import { BadRequestException } from '@nestjs/common';
import { createProjectLinkSchema, createTaskSchema, updateTaskSchema } from '@dotask/shared';
import { ZodValidationPipe } from './zod-validation.pipe';

describe('ZodValidationPipe', () => {
  it('aplica los valores por defecto del esquema', () => {
    const pipe = new ZodValidationPipe(createTaskSchema);
    expect(pipe.transform({ title: '  Comprar pan  ' })).toEqual({
      title: 'Comprar pan',
      status: 'pending',
      priority: 'none',
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
    expect(() => pipe.transform({ title: 'x', priority: 'urgente' })).toThrow(BadRequestException);
    expect(() => pipe.transform({ title: 'x', assigneeId: 'no-es-uuid' })).toThrow(BadRequestException);
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
