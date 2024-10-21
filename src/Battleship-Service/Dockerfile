# Dockerfile for Battleship Service
FROM openjdk:17-jdk-slim

# Set the working directory inside the container
WORKDIR /app

# Copy the JAR file from the target directory
COPY target/Battleship-Service-0.0.1-SNAPSHOT.jar battleship-service.jar

# Expose the port that the service will run on (example: 8081)
EXPOSE 8081

# Run the Battleship Service
CMD ["java", "-jar", "battleship-service.jar"]
