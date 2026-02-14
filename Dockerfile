FROM node:18-alpine

WORKDIR /app

# Copy package files and install server dependencies
COPY package.json ./
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --omit=dev

# Copy application source
COPY server/ ./server/
COPY client/ ./client/
COPY shared/ ./shared/

EXPOSE 3000

CMD ["npm", "start"]
