import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import type { AuthedRequest } from '../types';
import type { Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
    private readonly logger = new Logger('Request');

    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        if (context.getType() !== 'http') return next.handle();

        const req = context.switchToHttp().getRequest<AuthedRequest>();
        const res = context.switchToHttp().getResponse<Response>();
        const start = Date.now();

        return next.handle().pipe(
            tap(() => {
                const ms = Date.now() - start;
                // Health checks are noisy under container orchestration.
                if (req.originalUrl.startsWith('/api/health')) return;
                const tenant = req.principal?.orgId ? ` org=${req.principal.orgId}` : '';
                this.logger.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms${tenant}`);
            }),
        );
    }
}
