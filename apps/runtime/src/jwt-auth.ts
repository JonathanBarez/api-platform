import { Logger, UnauthorizedException } from "@nestjs/common";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { z } from "zod";
import type { JwtSettings } from "./jwt-settings";

const discoverySchema = z.object({
  issuer: z.string(),
  jwks_uri: z.string().url(),
}).passthrough();

export class AuthenticationGuard implements CanActivate {
  private readonly logger = new Logger(AuthenticationGuard.name);
  private verifier: Promise<(token: string) => Promise<void>> | undefined;

  constructor(private readonly settings?: JwtSettings) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request: unknown = context.switchToHttp().getRequest();
    const header = z.object({
      headers: z.object({ authorization: z.string().optional() }).passthrough(),
    }).passthrough().safeParse(request);
    const match = header.success ? /^Bearer ([^\s]+)$/i.exec(header.data.headers.authorization ?? "") : null;
    if (!match || !this.settings) throw new UnauthorizedException();
    try {
      if (!this.verifier) {
        this.verifier = this.createVerifier().catch((error: unknown) => {
          this.verifier = undefined;
          throw error;
        });
      }
      const verify = await this.verifier;
      await verify(match[1]);
      return true;
    } catch (error: unknown) {
      this.logger.warn(JSON.stringify({
        event: "jwt_authentication_failed",
        reason: error instanceof Error ? error.name : "unknown",
      }));
      throw new UnauthorizedException();
    }
  }

  private async createVerifier(): Promise<(token: string) => Promise<void>> {
    const settings = this.settings;
    if (!settings) throw new Error("JWT settings are not configured");
    const response = await fetch(settings.MetadataAddress, {
      redirect: "error",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error("OIDC discovery failed");
    const metadata = discoverySchema.parse(await response.json());
    if (metadata.issuer !== settings.Issuer) throw new Error("OIDC issuer mismatch");
    const jwks = new URL(metadata.jwks_uri);
    if (!["http:", "https:"].includes(jwks.protocol) || jwks.username || jwks.password || jwks.hash
      || (settings.RequireHttpsMetadata && jwks.protocol !== "https:")) {
      throw new Error("Invalid OIDC signing key URL");
    }
    const { createRemoteJWKSet, jwtVerify } = await import("jose");
    const keys = createRemoteJWKSet(jwks, { timeoutDuration: 5000 });
    const [hours, minutes, seconds] = settings.TokenValidationParameters.ClockSkew.split(":").map(Number);
    return async (token: string) => {
      await jwtVerify(token, keys, {
        algorithms: ["RS256"],
        issuer: settings.Issuer,
        audience: settings.Audience,
        requiredClaims: ["exp"],
        clockTolerance: hours * 3600 + minutes * 60 + seconds,
      });
    };
  }
}
