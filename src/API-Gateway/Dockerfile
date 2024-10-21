# Dockerfile for API Gateway
FROM node:18

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json to install dependencies
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the code
COPY . .

# Expose the port the gateway will run on (example: 3000)
EXPOSE 3000

# Start the API Gateway
CMD ["node", "server.js"]
