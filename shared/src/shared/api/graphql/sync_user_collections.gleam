import gleam/dynamic/decode
import gleam/json
import squall

pub type SyncResult {
  SyncResult(success: Bool, message: String)
}

pub fn sync_result_decoder() -> decode.Decoder(SyncResult) {
  use success <- decode.field("success", decode.bool)
  use message <- decode.field("message", decode.string)
  decode.success(SyncResult(success: success, message: message))
}

pub fn sync_result_to_json(input: SyncResult) -> json.Json {
  json.object(
    [
      #("success", json.bool(input.success)),
      #("message", json.string(input.message)),
    ],
  )
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

pub fn sync_user_collections_response_to_json(input: SyncUserCollectionsResponse) -> json.Json {
  json.object(
    [
      #("syncUserCollections", sync_result_to_json(input.sync_user_collections)),
    ],
  )
}

pub fn sync_user_collections(client: squall.Client, did: String) {
  squall.execute_query(
    client,
    "mutation SyncUserCollections($did: String!) { syncUserCollections(did: $did) { success message } }",
    json.object([#("did", json.string(did))]),
    sync_user_collections_response_decoder(),
  )
}
