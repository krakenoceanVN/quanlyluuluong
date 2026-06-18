import { HttpException, HttpStatus } from '@nestjs/common';

/** 422 with per-field validation details. */
export class UnprocessableEntityException extends HttpException {
  constructor(message = '参数校验失败', fields: Record<string, string[]> = {}) {
    super({ message, fields }, HttpStatus.UNPROCESSABLE_ENTITY);
  }
}

/** 409 for business-rule conflicts (e.g. deleting a resource still in use). */
export class BusinessConflictException extends HttpException {
  constructor(message: string) {
    super({ message }, HttpStatus.CONFLICT);
  }
}
