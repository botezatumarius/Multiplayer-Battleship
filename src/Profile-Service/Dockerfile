# Dockerfile for Profile Service
FROM openjdk:17-jdk-slim

# Set the working directory inside the container
WORKDIR /app

# Copy the JAR file from the target directory
COPY target/Profile-Service-0.0.1-SNAPSHOT.jar profile-service.jar

# Expose the port that the service will run on (example: 8082)
EXPOSE 8082

# Run the Profile Service
CMD ["java", "-jar", "profile-service.jar"]
