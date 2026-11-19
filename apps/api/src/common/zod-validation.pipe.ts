import { BadRequestException, PipeTransform } from '@nestjs/common';
import type { ZodTypeAny, infer as ZodInfer } from 'zod';

/**
 * Valida y normaliza el body con un esquema de `@dotask/shared`.
 * Uso: `@Body(new ZodValidationPipe(createTaskSchema)) body: CreateTaskInput`.
 */
export class ZodValidationPipe<S extends ZodTypeAny> implements PipeTransform<unknown, ZodInfer<S>> {
  constructor(private readonly schema: S) {}

  transform(value: unknown): ZodInfer<S> {
    const result = this.schema.safeParse(value ?? {});
    if (result.success) return result.data;
    throw new BadRequestException({
      message: 'Datos inválidos',
      errors: result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }
}
