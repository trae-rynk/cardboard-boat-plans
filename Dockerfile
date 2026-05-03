# syntax = docker/dockerfile:1

# Adjust NODE_VERSION as desired
ARG NODE_VERSION=22.21.1
FROM node:${NODE_VERSION}-slim AS base

LABEL fly_launch_runtime="Node.js"

# Node.js app lives here
WORKDIR /app

# Set production environment

# Install pnpm
ARG PNPM_VERSION=latest

ARG EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY
ENV EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=$EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY

RUN npm install -g pnpm@$PNPM_VERSION


# Throw-away build stage to reduce size of final image
FROM base AS build

ENV NODE_ENV=development

# Install packages needed to build node modules
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential node-gyp pkg-config python-is-python3

# Install node modules
COPY .npmrc package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod=false

# Copy application code
COPY . .

# Build application
RUN echo "Build NODE_ENV=$NODE_ENV"

RUN echo "=== package.json scripts ===" && \
    node -e "console.log(require('./package.json').scripts)"

RUN echo "=== search source for nativewind/css-interop ===" && \
    grep -R "react-native-css-interop\|nativewind" . \
      --exclude-dir=node_modules \
      --exclude-dir=.git \
      --exclude-dir=web-dist \
      --exclude-dir=dist \
      || true

RUN echo "=== pnpm why react-native-css-interop ===" && \
    pnpm why react-native-css-interop || true

RUN echo "=== pnpm list react-native-css-interop ===" && \
    pnpm list react-native-css-interop --depth 20 || true

RUN echo "=== does node_modules/react-native-css-interop exist? ===" && \
    if [ -d node_modules/react-native-css-interop ]; then \
      echo "FOUND react-native-css-interop"; \
      cat node_modules/react-native-css-interop/package.json; \
    else \
      echo "NOT FOUND react-native-css-interop"; \
    fi

RUN node -e "console.log('Stripe public key present:', Boolean(process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY), 'prefix:', (process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '').slice(0, 3))"    

RUN node -e "console.log('All EXPO_PUBLIC vars:', Object.keys(process.env).filter(k => k.startsWith('EXPO_PUBLIC_')))"

RUN node -e "console.log('Stripe secret key present at build:', Boolean(process.env.STRIPE_SECRET_KEY), 'prefix:', (process.env.STRIPE_SECRET_KEY || '').slice(0, 3))"

RUN echo "=== now running build ===" && pnpm run build

# Remove development dependencies
RUN pnpm prune --prod


# Final stage for app image
FROM base

ENV NODE_ENV=production

# Copy built application
COPY --from=build /app /app

# Start the server by default, this can be overwritten at runtime
EXPOSE 3000
CMD [ "pnpm", "run", "start" ]
