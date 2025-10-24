# server

[![Package Version](https://img.shields.io/hexpm/v/server)](https://hex.pm/packages/server)
[![Hex Docs](https://img.shields.io/badge/hex-docs-ffaff3)](https://hexdocs.pm/server/)

```sh
gleam add server@1
```
```gleam
import server

pub fn main() -> Nil {
  // TODO: An example of the project in use
}
```

Further documentation can be found at <https://hexdocs.pm/server>.

## Development

```sh
gleam run   # Run the project
gleam test  # Run the tests
```

## GraphQL Code Generation

This project uses [Squall](https://github.com/bigmoves/squall) to generate type-safe GraphQL queries from `.gql` files.

### Regenerating GraphQL Code

After modifying any `.gql` files in `src/api/graphql/`, regenerate the type-safe Gleam code:

```sh
# Using make (recommended)
make generate-graphql

# Or directly with gleam
gleam run -m squall generate "https://api.slices.network/graphql?slice=at://did:plc:bcgltzqazw5tb6k2g3ttenbj/network.slices.slice/3m3gc7lhwzx2z"
```

This will:
- Introspect the GraphQL schema
- Find all `.gql` files in `src/api/graphql/`
- Generate type-safe `.gleam` files with decoders and input types

### GraphQL Queries

All GraphQL operations are defined in `src/api/graphql/`:
- `get_profile.gql` - Fetch profile by handle
- `upload_blob.gql` - Upload blob mutation
- `update_profile.gql` - Update profile mutation
- `check_profile_exists.gql` - Check if profile exists
- `sync_user_collections.gql` - Sync user collections
- `get_bluesky_profile.gql` - Get Bluesky profile
- `create_profile.gql` - Create new profile
