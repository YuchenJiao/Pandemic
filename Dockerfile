FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --chown=node:node . .
RUN mkdir -p /app/room-data && chown node:node /app/room-data
ENV NODE_ENV=production
EXPOSE 3000
USER node
CMD ["npm", "start"]
