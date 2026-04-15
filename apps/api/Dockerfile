FROM node:20-alpine AS build
WORKDIR /app

COPY package.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN npm install --workspace=apps/api --include-workspace-root

COPY packages/shared/ packages/shared/
COPY apps/api/ apps/api/
RUN cd apps/api && npx prisma generate
RUN npm run build --workspace=apps/api

FROM node:20-alpine
WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/prisma ./prisma

ENV NODE_ENV=production
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
