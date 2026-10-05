FROM node:22-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
COPY public ./public
COPY migrations ./migrations
COPY scripts ./scripts
COPY docs ./docs
RUN npm run typecheck
ENV NODE_ENV=production
EXPOSE 3000
USER node
CMD ["npm","start"]
