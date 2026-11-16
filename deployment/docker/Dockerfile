FROM node:22-bookworm-slim AS build
WORKDIR /workspace
COPY . .
RUN npm ci && npx nx run-many -t build --parallel=3
RUN npm prune --omit=dev --ignore-scripts

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/package.json ./package.json
COPY --from=build /workspace/apps/runtime/package.json ./apps/runtime/package.json
COPY --from=build /workspace/apps/runtime/dist ./apps/runtime/dist
COPY --from=build /workspace/libs/plugin-api/package.json ./libs/plugin-api/package.json
COPY --from=build /workspace/libs/plugin-api/dist ./libs/plugin-api/dist
COPY --from=build /workspace/shared-models/package.json ./shared-models/package.json
COPY --from=build /workspace/shared-models/dist ./shared-models/dist
COPY --from=build /workspace/platform/plugin-loader/package.json ./platform/plugin-loader/package.json
COPY --from=build /workspace/platform/plugin-loader/dist ./platform/plugin-loader/dist
COPY --from=build /workspace/platform/plugin-registry/package.json ./platform/plugin-registry/package.json
COPY --from=build /workspace/platform/plugin-registry/dist ./platform/plugin-registry/dist
COPY --from=build /workspace/platform/validation/package.json ./platform/validation/package.json
COPY --from=build /workspace/platform/validation/dist ./platform/validation/dist
COPY --from=build /workspace/platform/telemetry/package.json ./platform/telemetry/package.json
COPY --from=build /workspace/platform/telemetry/dist ./platform/telemetry/dist
COPY --from=build /workspace/backend-adapters/billing-adapter/package.json ./backend-adapters/billing-adapter/package.json
COPY --from=build /workspace/backend-adapters/billing-adapter/dist ./backend-adapters/billing-adapter/dist
COPY --from=build /workspace/capabilities/billing-capability/package.json ./capabilities/billing-capability/package.json
COPY --from=build /workspace/capabilities/billing-capability/dist ./capabilities/billing-capability/dist
COPY --from=build /workspace/plugins/core-team-plugins/billing-reference-plugin/package.json ./plugins/core-team-plugins/billing-reference-plugin/package.json
COPY --from=build /workspace/plugins/core-team-plugins/billing-reference-plugin/dist ./plugins/core-team-plugins/billing-reference-plugin/dist
USER node
EXPOSE 3000
CMD ["node", "apps/runtime/dist/main.js"]
