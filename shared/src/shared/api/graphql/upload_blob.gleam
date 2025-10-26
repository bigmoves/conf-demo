import gleam/dynamic/decode
import gleam/json
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

pub fn blob_upload_response_to_json(input: BlobUploadResponse) -> json.Json {
  json.object([#("blob", blob_to_json(input.blob))])
}

pub fn blob_to_json(input: Blob) -> json.Json {
  json.object(
    [
      #("ref", json.string(input.ref)),
      #("mimeType", json.string(input.mime_type)),
      #("size", json.int(input.size)),
    ],
  )
}

pub type UploadBlobResponse {
  UploadBlobResponse(upload_blob: BlobUploadResponse)
}

pub fn upload_blob_response_decoder() -> decode.Decoder(UploadBlobResponse) {
  use upload_blob <- decode.field("uploadBlob", blob_upload_response_decoder())
  decode.success(UploadBlobResponse(upload_blob: upload_blob))
}

pub fn upload_blob_response_to_json(input: UploadBlobResponse) -> json.Json {
  json.object(
    [
      #("uploadBlob", blob_upload_response_to_json(input.upload_blob)),
    ],
  )
}

pub fn upload_blob(client: squall.Client, data: String, mime_type: String) {
  squall.execute_query(
    client,
    "mutation UploadBlob($data: String!, $mimeType: String!) { uploadBlob(data: $data, mimeType: $mimeType) { blob { ref mimeType size } } }",
    json.object(
      [
        #("data", json.string(data)),
        #("mimeType", json.string(mime_type)),
      ],
    ),
    upload_blob_response_decoder(),
  )
}
