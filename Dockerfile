FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --chown=node:node . .
ENV NODE_ENV=production
ENV DATA_FILE=/tmp/aethra.json
EXPOSE 8080
USER node
CMD ["node", "server.js"]
