# ─────────────────────────────────────────────
# Build stage (uses Maven image with cache)
# ─────────────────────────────────────────────
FROM maven:3.9.6-eclipse-temurin-17 AS build
WORKDIR /app

# 1️⃣ Cache dependencies
COPY pom.xml .
RUN mvn dependency:go-offline -B

# 2️⃣ Copy source after deps are cached
COPY src ./src
RUN mvn clean package -DskipTests

# ─────────────────────────────────────────────
# Runtime stage (small & secure)
# ─────────────────────────────────────────────
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# JVM container optimizations
ENV JAVA_OPTS="\
-XX:+UseContainerSupport \
-XX:MaxRAMPercentage=75 \
-XX:+ExitOnOutOfMemoryError \
-XX:+UseG1GC"

COPY --from=build /app/target/*.jar app.jar

EXPOSE 8080
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]