# syntax=docker/dockerfile:1.7
FROM node:24.13.0-alpine AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
WORKDIR /workspace

RUN corepack enable && corepack prepare pnpm@11.21.0 --activate

COPY . .
RUN pnpm install --frozen-lockfile

ARG PACKAGE_FILTER
ARG ENTRYPOINT
RUN test -n "$PACKAGE_FILTER" && test -n "$ENTRYPOINT"
RUN pnpm build --filter="${PACKAGE_FILTER}..."
RUN node deploy/build-runtime.mjs "$ENTRYPOINT"
RUN pnpm --filter="$PACKAGE_FILTER" deploy --prod --legacy /runtime

FROM node:24.13.0-alpine AS runtime

ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app

COPY --from=build --chown=10001:10001 /runtime/ ./
COPY --from=build --chown=10001:10001 /workspace/app.mjs ./app.mjs
COPY --chown=10001:10001 deploy/healthcheck.mjs ./healthcheck.mjs

USER 10001:10001
EXPOSE 3000
CMD ["node", "app.mjs"]
