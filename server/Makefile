.PHONY: help download-schema generate-graphql dev test build

GRAPHQL_ENDPOINT := https://api.slices.network/graphql?slice=at://did:plc:bcgltzqazw5tb6k2g3ttenbj/network.slices.slice/3m3gc7lhwzx2z

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-20s %s\n", $$1, $$2}'

download-schema: ## Download GraphQL schema from endpoint
	@echo "Downloading GraphQL schema from $(GRAPHQL_ENDPOINT)..."
	@npx get-graphql-schema $(GRAPHQL_ENDPOINT) > schema.graphql
	@echo "Schema saved to schema.graphql"

generate-graphql: ## Regenerate GraphQL type-safe code from .gql files
	gleam run -m squall generate "$(GRAPHQL_ENDPOINT)"

dev: ## Run the development server
	gleam run

test: ## Run tests
	gleam test

build: ## Build the project
	gleam build
