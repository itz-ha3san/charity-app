FROM node:24.14.1-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY tsconfig*.json ./
COPY src ./src
COPY scripts/build.mjs scripts/check-frontend.mjs ./scripts/
COPY public ./public
RUN npm run build

FROM node:24.14.1-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY public ./public
COPY migrations ./migrations
COPY scripts ./scripts
COPY docs ./docs
USER node
EXPOSE 3000
CMD ["npm","run","start:compiled"]
