import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { DomainError, NotFoundError } from '../domain/analysis';

@Catch(DomainError)
export class DomainErrorFilter implements ExceptionFilter {
  catch(error: DomainError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    res.status(error instanceof NotFoundError ? 404 : 422).json({ detail: error.message });
  }
}
