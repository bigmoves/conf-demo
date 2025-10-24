ARG GLEAM_VERSION=v1.13.0

# Build stage - compile the application
FROM ghcr.io/gleam-lang/gleam:${GLEAM_VERSION}-erlang-alpine AS builder

# Install build dependencies
RUN apk add --no-cache \
    git \
    nodejs \
    npm \
    build-base \
    sqlite-dev

# Configure git for non-interactive use
ENV GIT_TERMINAL_PROMPT=0

# Add project code
COPY ./shared /build/shared
COPY ./client /build/client
COPY ./server /build/server

# Install dependencies for all projects
RUN cd /build/shared && gleam deps download
RUN cd /build/client && gleam deps download
RUN cd /build/server && gleam deps download

# Install JavaScript dependencies for client
RUN cd /build/client && npm install

# Compile the client code and output to server's static directory
RUN cd /build/client \
    && gleam add --dev lustre_dev_tools \
    && gleam run -m lustre/dev build client --minify --outdir=/build/server/priv/static

# Compile the server code
RUN cd /build/server \
    && gleam export erlang-shipment

# Runtime stage - slim image with only what's needed to run
FROM ghcr.io/gleam-lang/gleam:${GLEAM_VERSION}-erlang-alpine

# Copy the compiled server code from the builder stage
COPY --from=builder /build/server/build/erlang-shipment /app

# Set up the entrypoint
WORKDIR /app
RUN echo -e '#!/bin/sh\nexec ./entrypoint.sh "$@"' > ./start.sh \
    && chmod +x ./start.sh

# Set environment variables
ENV HOST=0.0.0.0
ENV PORT=8080

# Expose the port the server will run on
EXPOSE $PORT

# Run the server
CMD ["./start.sh", "run"]
