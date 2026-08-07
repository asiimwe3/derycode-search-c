FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends gcc libc6-dev curl ca-certificates
WORKDIR /app
COPY . .
RUN make
EXPOSE 8080
CMD ["./derycode-search", "8080"]
