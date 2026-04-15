FROM node:20-alpine AS build
WORKDIR /app

COPY package.json ./
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm install --workspace=apps/web --include-workspace-root

COPY packages/shared/ packages/shared/
COPY apps/web/ apps/web/

ARG VITE_API_URL=https://api.app-sprint.com
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build --workspace=apps/web

FROM nginx:alpine
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
