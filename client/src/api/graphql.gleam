import gleam/fetch
import gleam/http
import gleam/http/request
import gleam/int
import gleam/javascript/promise
import gleam/json
import gleam/result

/// Configuration for the GraphQL endpoint
pub type Config {
  Config(api_url: String, slice_uri: String, access_token: String)
}

/// Execute a GraphQL query and return a promise with the response body as a string
pub fn execute_query(
  config: Config,
  query: String,
  variables: json.Json,
) -> promise.Promise(Result(String, String)) {
  // Build the GraphQL request URL with slice parameter
  let url = config.api_url <> "/graphql?slice=" <> config.slice_uri

  // Build the GraphQL request body
  let body =
    json.object([#("query", json.string(query)), #("variables", variables)])
    |> json.to_string

  // Create HTTP request
  let assert Ok(req) =
    request.to(url)
    |> result.map(fn(r) {
      r
      |> request.set_method(http.Post)
      |> request.set_body(body)
      |> request.prepend_header("Content-Type", "application/json")
      |> request.prepend_header("Authorization", "Bearer " <> config.access_token)
    })

  // Send the request and read body as text
  fetch.send(req)
  |> promise.try_await(fn(resp) {
    case resp.status {
      200 -> fetch.read_text_body(resp)
      status ->
        promise.resolve(Error(fetch.NetworkError("HTTP " <> int.to_string(status))))
    }
  })
  |> promise.map(fn(result) {
    result
    |> result.map(fn(resp) { resp.body })
    |> result.map_error(fn(_) { "Request failed" })
  })
}
