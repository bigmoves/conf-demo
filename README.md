# Gleam Lustre Fullstack App

A fullstack demo application built with Gleam and Lustre. Users can authenticate via OAuth, view and edit their profiles.

## Features

- **OAuth 2.0 Authentication** - Secure authentication with PKCE flow for Bluesky/ATProto
- **Profile Management** - View and edit user profiles with display name, description, avatar, location, and interests
- **Avatar Upload** - Upload and preview profile images with decentralized blob storage
- **Location Search** - Autocomplete location selection with H3 geohashing for geographic indexing
- **Server-Side Rendering** - Fast initial page loads with prerendered profile data
- **Client-Side Routing** - Smooth navigation with Modem routing library
- **Session Management** - Secure cookie-based sessions with SQLite storage
- **GraphQL Integration** - Direct integration with Slices network API for ATProto data

## Tech Stack

### Frontend (Client)
- **Gleam** - Type-safe functional language compiled to JavaScript
- **Lustre** - Elm-inspired web framework for reactive UIs
- **Modem** - Client-side routing
- **h3-js** - H3 geohashing for location indexing
- **Tailwind CSS** - Utility-first CSS framework

### Backend (Server)
- **Gleam** - Compiled to Erlang/BEAM
- **Wisp** - Web framework for request handling
- **Mist** - HTTP server runtime
- **SQLight** - SQLite database driver
- **Storail** - Session management
- **Glow Auth** - OAuth utilities
- **Squall** - Type-safe GraphQL code generator

### Shared
- Monorepo structure with shared types and utilities between client and server

## Prerequisites

- [Gleam](https://gleam.run/) (latest version)
- [Erlang/OTP](https://www.erlang.org/) (for server)
- [Node.js](https://nodejs.org/) and npm (for client dependencies)

## Project Structure

```
lustre-fullstack/
├── client/              # Lustre frontend (SPA)
│   ├── src/
│   │   ├── client.gleam # Main entry point
│   │   ├── pages/       # Page components
│   │   └── ui/          # Reusable UI components
│   ├── gleam.toml
│   └── package.json
├── server/              # Wisp backend
│   ├── src/
│   │   ├── server.gleam # Main server & routing
│   │   ├── api/         # API handlers
│   │   └── oauth/       # OAuth & session logic
│   ├── gleam.toml
│   ├── .env.example
│   └── priv/static/     # Built client output
└── shared/              # Shared code between client & server
    └── src/shared/
        └── profile.gleam # Profile types & codecs
```

## Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd conf-demo
```

### 2. Set Up Server

```bash
cd server

# Install Gleam dependencies
gleam deps download

# Copy environment template
cp .env.example .env

# Edit .env with your configuration
# Generate SECRET_KEY_BASE with: openssl rand -base64 48
```

### 3. Set Up Client

```bash
cd client

# Install Gleam dependencies
gleam deps download

# Install npm dependencies (h3-js)
npm install
```

### 4. Set Up Shared Package

```bash
cd shared
gleam deps download
```

## Configuration

Edit `server/.env` with your OAuth and application settings:

```bash
# Secret Key Base (generate with: openssl rand -base64 48)
SECRET_KEY_BASE=your_random_64_character_string

# OAuth Configuration
OAUTH_CLIENT_ID=your_oauth_client_id
OAUTH_CLIENT_SECRET=your_oauth_client_secret
OAUTH_REDIRECT_URI=http://localhost:3000/oauth/callback
OAUTH_AUTH_URL=https://auth.slices.network
```

## Development

### Build Client

The client builds directly into `server/priv/static` for serving:

```bash
cd client
gleam run
```

This compiles the Lustre app with minification and outputs to `../server/priv/static`.

### Run Server

```bash
cd server
gleam run
```

The server starts on `http://localhost:3000` and serves the built client from `priv/static`.

### Development Workflow

1. Make changes to client code in `client/src/`
2. Rebuild client: `cd client && gleam run`
3. Server automatically serves updated static files
4. For server changes, restart the server

Alternatively, run both in separate terminals with auto-rebuild on file changes using your preferred file watcher.

## API Endpoints

### Public Routes
- `GET /` - Home page
- `GET /login` - Login page
- `GET /profile/:handle` - View profile (with SSR)
- `POST /oauth/authorize` - Initiate OAuth flow
- `GET /oauth/callback` - OAuth callback

### Protected Routes (Require Authentication)
- `GET /profile/:handle/edit` - Edit profile page
- `POST /api/profile/:handle/update` - Update profile data
- `POST /logout` - Logout

### API Routes
- `GET /api/user/current` - Get current authenticated user
- `GET /api/profile/:handle` - Fetch profile data (JSON)

## Database

The application uses SQLite for session storage:
- Database file: `server/sessions.db` (auto-created on first run)
- Schema managed by `server/src/oauth/session.gleam`

## Features in Detail

### OAuth with PKCE
Implements OAuth 2.0 with Proof Key for Code Exchange (PKCE) for secure authentication without storing client secrets in the browser.

### H3 Geohashing
Location data is indexed using Uber's H3 geospatial indexing system for efficient location queries and autocomplete.

### Server-Side Rendering
Profile pages include prerendered data in the initial HTML response, embedded as JSON in a script tag for instant hydration.

### GraphQL Integration
Type-safe GraphQL queries and mutations generated from `.gql` files using Squall. All GraphQL operations are defined in `server/src/api/graphql/` and automatically generate type-safe Gleam code with decoders and input types.

To regenerate GraphQL code after modifying `.gql` files:
```bash
cd server
make generate-graphql
```

## Building for Production

### Client
```bash
cd client
gleam run  # Outputs minified bundle to ../server/priv/static
```

### Server
```bash
cd server
gleam build
gleam run
```

The server serves the built client from `priv/static` at runtime.

## Testing

```bash
# Test client
cd client
gleam test

# Test server
cd server
gleam test

# Test shared
cd shared
gleam test
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

Apache License, Version 2.0

## Acknowledgments

- Built with [Gleam](https://gleam.run/)
- Frontend powered by [Lustre](https://github.com/lustre-labs/lustre)
- Backend powered by [Wisp](https://github.com/gleam-wisp/wisp) and [Mist](https://github.com/rawhat/mist)
- Location indexing with [H3](https://h3geo.org/)
