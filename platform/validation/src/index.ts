import {
  BadRequestException, InternalServerErrorException, Logger,
} from "@nestjs/common";
import type { CallHandler, ExecutionContext, NestInterceptor } from "@nestjs/common";
import type { PluginRequestMetadata, PluginRoute } from "@api-platform/plugin-api";
import { defer, from, mergeMap } from "rxjs";
import type { Observable } from "rxjs";

const requestMetadata = Symbol("validatedPluginRequest");
interface ValidatedRequest {
  body: unknown;
  params: unknown;
  query: unknown;
  [requestMetadata]?: PluginRequestMetadata;
}

export function getValidatedRequestMetadata(request: ValidatedRequest): PluginRequestMetadata {
  const metadata = request[requestMetadata];
  if (!metadata) throw new InternalServerErrorException("Request validation unavailable");
  return metadata;
}

export class PluginValidationInterceptor implements NestInterceptor {
  private readonly logger = new Logger(PluginValidationInterceptor.name);

  constructor(
    private readonly route: PluginRoute,
    private readonly pluginName: string,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<ValidatedRequest>();
    return defer(async () => {
      const body = await this.route.requestSchema.safeParseAsync(request.body);
      const params = this.route.paramsSchema
        ? await this.route.paramsSchema.safeParseAsync(request.params) : undefined;
      const query = this.route.querySchema
        ? await this.route.querySchema.safeParseAsync(request.query) : undefined;
      if (!body.success || (params && !params.success) || (query && !query.success)) {
        throw new BadRequestException("Invalid request");
      }
      request.body = body.data;
      request[requestMetadata] = {
        params: params?.success ? params.data : undefined,
        query: query?.success ? query.data : undefined,
      };
    }).pipe(
      mergeMap(() => next.handle()),
      mergeMap((value: unknown) => from(this.route.responseSchema.safeParseAsync(value))),
      mergeMap((response) => {
        if (!response.success) {
          this.logger.error(JSON.stringify({
            event: "plugin_response_invalid",
            plugin: this.pluginName,
            route: this.route.path,
          }));
          throw new InternalServerErrorException("Invalid plugin response");
        }
        return [response.data];
      }),
    );
  }
}
