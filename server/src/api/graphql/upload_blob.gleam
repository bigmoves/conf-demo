import gleam/dynamic/decode
import gleam/http
import gleam/http/request
import gleam/httpc
import gleam/json
import gleam/list
import gleam/result
import squall

pub type BlobUploadResponse {
  BlobUploadResponse(blob: Blob)
}

pub fn blob_upload_response_decoder() -> decode.Decoder(BlobUploadResponse) {
  use blob <- decode.field("blob", blob_decoder())
  decode.success(BlobUploadResponse(blob: blob))
}

pub type Blob {
  Blob(ref: String, mime_type: String, size: Int)
}

pub fn blob_decoder() -> decode.Decoder(Blob) {
  use ref <- decode.field("ref", decode.string)
  use mime_type <- decode.field("mimeType", decode.string)
  use size <- decode.field("size", decode.int)
  decode.success(Blob(ref: ref, mime_type: mime_type, size: size))
}

pub type UploadBlobResponse {
  UploadBlobResponse(upload_blob: BlobUploadResponse)
}

pub fn upload_blob_response_decoder() -> decode.Decoder(UploadBlobResponse) {
  use upload_blob <- decode.field("uploadBlob", blob_upload_response_decoder())
  decode.success(UploadBlobResponse(upload_blob: upload_blob))
}

pub fn upload_blob(
  client: squall.Client,
  data: String,
  mime_type: String,
) -> Result(UploadBlobResponse, String) {
  let query =
    "mutation UploadBlob($data: String!, $mimeType: String!) { uploadBlob(data: $data, mimeType: $mimeType) { blob { ref mimeType size } } }"
  let variables =
    json.object([
      #("data", json.string(data)),
      #("mimeType", json.string(mime_type)),
    ])
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
    use data <- decode.field("data", upload_blob_response_decoder())
    decode.success(data)
  }
  decode.run(json_value, data_and_response_decoder)
  |> result.map_error(fn(_) { "Failed to decode response data" })
}
