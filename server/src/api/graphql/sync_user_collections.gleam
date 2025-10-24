import gleam/dynamic/decode
import gleam/http
import gleam/http/request
import gleam/httpc
import gleam/json
import gleam/list
import gleam/result
import squall

pub type SyncResult {
  SyncResult(success: Bool, message: String)
}

pub fn sync_result_decoder() -> decode.Decoder(SyncResult) {
  use success <- decode.field("success", decode.bool)
  use message <- decode.field("message", decode.string)
  decode.success(SyncResult(success: success, message: message))
}

pub type SyncUserCollectionsResponse {
  SyncUserCollectionsResponse(sync_user_collections: SyncResult)
}

pub fn sync_user_collections_response_decoder() -> decode.Decoder(SyncUserCollectionsResponse) {
  use sync_user_collections <- decode.field("syncUserCollections", sync_result_decoder())
  decode.success(SyncUserCollectionsResponse(
    sync_user_collections: sync_user_collections,
  ))
}

pub fn sync_user_collections(client: squall.Client, did: String) -> Result(SyncUserCollectionsResponse, String) {
  let query =
    "mutation SyncUserCollections($did: String!) { syncUserCollections(did: $did) { success message } }"
  let variables =
    json.object([#("did", json.string(did))])
  let body =
    json.object([#("query", json.string(query)), #("variables", variables)])
  use req <- result.try(
    request.to(client.endpoint)
    |> result.map_error(fn(_) { "Invalid endpoint URL" }),
  )
  let req =
    req
    |> request.set_method(http.Post)
    |> request.set_body(json.to_string(body))
    |> request.set_header("content-type", "application/json")
  let req =
    list.fold(client.headers, req, fn(r, header) {
      request.set_header(r, header.0, header.1)
    })
  use resp <- result.try(
    httpc.send(req)
    |> result.map_error(fn(_) { "HTTP request failed" }),
  )
  use json_value <- result.try(
    json.parse(from: resp.body, using: decode.dynamic)
    |> result.map_error(fn(_) { "Failed to decode JSON response" }),
  )
  let data_and_response_decoder = {
    use data <- decode.field("data", sync_user_collections_response_decoder())
    decode.success(data)
  }
  decode.run(json_value, data_and_response_decoder)
  |> result.map_error(fn(_) { "Failed to decode response data" })
}
