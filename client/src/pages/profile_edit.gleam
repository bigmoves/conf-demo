import gleam/dynamic/decode
import gleam/option.{type Option}
import gleam/string
import lustre/attribute
import lustre/element.{type Element}
import lustre/element/html
import lustre/event
import shared/api/types.{type Profile}
import ui/avatar
import ui/button
import ui/input
import ui/location_input
import ui/textarea
import utils/location

pub type AvatarFileData {
  AvatarFileData(preview_url: String, base64_data: String, mime_type: String)
}

pub type Msg {
  DisplayNameUpdated(String)
  DescriptionUpdated(String)
  InterestsUpdated(String)
  AvatarFileChanged(List(File))
  AvatarFileProcessed(AvatarFileData)
  LocationInputMsg(location_input.Msg)
  FormSubmitted
  SaveCompleted(Result(Profile, String))
  CancelClicked
}

pub type File {
  File(name: String, size: Int, mime_type: String)
}

pub type FormData {
  FormData(
    display_name: String,
    description: String,
    location_input: location_input.Model,
    interests: String,
    avatar_preview_url: Option(String),
    avatar_file_data: Option(AvatarFileData),
    success_message: Option(String),
    error_message: Option(String),
    is_saving: Bool,
  )
}

pub fn update(form_data: FormData, msg: Msg) -> FormData {
  case msg {
    DisplayNameUpdated(value) -> FormData(..form_data, display_name: value)
    DescriptionUpdated(value) -> FormData(..form_data, description: value)
    InterestsUpdated(value) -> FormData(..form_data, interests: value)
    AvatarFileChanged(_files) -> form_data
    // Handled in parent with effect
    AvatarFileProcessed(file_data) ->
      FormData(
        ..form_data,
        avatar_preview_url: option.Some(file_data.preview_url),
        avatar_file_data: option.Some(file_data),
      )
    _ -> form_data
  }
}

pub fn init_form_data(profile: Option(Profile)) -> FormData {
  case profile {
    option.Some(p) -> {
      let interests_str = case p.interests {
        option.Some(list) -> string.join(list, ", ")
        option.None -> ""
      }

      // Extract avatar URL from nested Blob structure
      let avatar_url = case p.avatar {
        option.Some(blob) -> option.Some(blob.url)
        option.None -> option.None
      }

      // Convert HomeTown to LocationData
      let location_data = case p.home_town {
        option.Some(town) ->
          case town.name, town.value {
            option.Some(name), option.Some(h3_index) ->
              option.Some(location.LocationData(
                name: name,
                lat: 0.0,
                lon: 0.0,
                h3_index: h3_index,
              ))
            _, _ -> option.None
          }
        option.None -> option.None
      }

      FormData(
        display_name: option.unwrap(p.display_name, ""),
        description: option.unwrap(p.description, ""),
        location_input: location_input.init(location_data),
        interests: interests_str,
        avatar_preview_url: avatar_url,
        avatar_file_data: option.None,
        success_message: option.None,
        error_message: option.None,
        is_saving: False,
      )
    }
    option.None ->
      FormData(
        display_name: "",
        description: "",
        location_input: location_input.init(option.None),
        interests: "",
        avatar_preview_url: option.None,
        avatar_file_data: option.None,
        success_message: option.None,
        error_message: option.None,
        is_saving: False,
      )
  }
}

pub fn view(
  profile: Option(Profile),
  form_data: FormData,
  handle: String,
  on_msg: fn(Msg) -> msg,
) -> Element(msg) {
  html.div([attribute.class("space-y-8")], [
    // Header
    html.div([attribute.class("border-b border-zinc-800 pb-6")], [
      html.button(
        [
          attribute.class(
            "inline-flex items-center gap-2 text-zinc-400 hover:text-zinc-200 transition-colors mb-4",
          ),
          event.on_click(on_msg(CancelClicked)),
        ],
        [
          html.text("← Back to Profile"),
        ],
      ),
      html.h2([attribute.class("text-3xl font-bold text-white mb-2")], [
        html.text("Profile Settings"),
      ]),
      html.p([attribute.class("text-zinc-500 text-sm")], [
        html.text("@" <> handle),
      ]),
    ]),
    // Success/Error Messages
    case form_data.success_message {
      option.Some(msg) ->
        html.div(
          [
            attribute.class(
              "p-4 bg-green-900/20 border border-green-800 rounded-lg text-green-300 text-sm",
            ),
          ],
          [html.text(msg)],
        )
      option.None -> element.none()
    },
    case form_data.error_message {
      option.Some(msg) ->
        html.div(
          [
            attribute.class(
              "p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-300 text-sm",
            ),
          ],
          [html.text(msg)],
        )
      option.None -> element.none()
    },
    // Form
    html.form(
      [
        attribute.class("space-y-6"),
        event.on_submit(fn(_) { on_msg(FormSubmitted) }),
      ],
      [
        html.div(
          [
            attribute.class(
              "bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-6",
            ),
          ],
          [
            // Avatar Section
            html.div([attribute.class("space-y-2")], [
              html.label([attribute.class("text-sm font-medium text-white")], [
                html.text("Avatar"),
              ]),
              html.div([attribute.class("flex items-center gap-4")], [
                avatar.avatar(
                  form_data.avatar_preview_url,
                  option.unwrap(
                    profile |> option.then(fn(p) { p.display_name }),
                    handle,
                  ),
                  avatar.Lg,
                ),
                html.label(
                  [
                    attribute.attribute("for", "avatar-upload"),
                    attribute.class(
                      "cursor-pointer px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-sm transition-colors",
                    ),
                  ],
                  [html.text("Change Avatar")],
                ),
                html.input([
                  attribute.type_("file"),
                  attribute.id("avatar-upload"),
                  attribute.accept(["image/*"]),
                  attribute.class("hidden"),
                  event.on(
                    "change",
                    decode.map(decode.dynamic, fn(_) {
                      on_msg(AvatarFileChanged([]))
                    }),
                  ),
                ]),
              ]),
            ]),
            // Display Name
            html.div([attribute.class("space-y-2")], [
              html.label([attribute.class("text-sm font-medium text-white")], [
                html.text("Display Name"),
              ]),
              input.input([
                attribute.type_("text"),
                attribute.placeholder("Your display name"),
                attribute.value(form_data.display_name),
                event.on_input(fn(value) { on_msg(DisplayNameUpdated(value)) }),
              ]),
            ]),
            // Description
            html.div([attribute.class("space-y-2")], [
              html.label([attribute.class("text-sm font-medium text-white")], [
                html.text("Description"),
              ]),
              textarea.textarea(
                [
                  attribute.placeholder("Tell us about yourself..."),
                  event.on_input(fn(value) { on_msg(DescriptionUpdated(value)) }),
                ],
                form_data.description,
              ),
            ]),
            // Home Town
            html.div([attribute.class("space-y-2")], [
              html.label([attribute.class("text-sm font-medium text-white")], [
                html.text("Home Town"),
              ]),
              location_input.view(
                form_data.location_input,
                "Search for your hometown...",
              )
                |> element.map(fn(msg) { on_msg(LocationInputMsg(msg)) }),
            ]),
            // Interests
            html.div([attribute.class("space-y-2")], [
              html.label([attribute.class("text-sm font-medium text-white")], [
                html.text("Interests"),
              ]),
              html.p([attribute.class("text-xs text-zinc-400")], [
                html.text("Enter your interests, separated by commas"),
              ]),
              input.input([
                attribute.type_("text"),
                attribute.placeholder(
                  "e.g., web development, photography, hiking",
                ),
                attribute.value(form_data.interests),
                event.on_input(fn(value) { on_msg(InterestsUpdated(value)) }),
              ]),
            ]),
          ],
        ),
        // Action Buttons
        html.div([attribute.class("flex justify-end gap-3")], [
          button.button(
            [
              attribute.type_("button"),
              event.on_click(on_msg(CancelClicked)),
            ],
            button.Default,
            button.Md,
            [html.text("Cancel")],
          ),
          button.button(
            [
              attribute.type_("submit"),
              attribute.disabled(form_data.is_saving),
            ],
            button.Primary,
            button.Md,
            [
              html.text(case form_data.is_saving {
                True -> "Saving..."
                False -> "Save Changes"
              }),
            ],
          ),
        ]),
      ],
    ),
  ])
}
