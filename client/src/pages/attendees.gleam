import gleam/list
import gleam/option
import lustre/attribute
import lustre/element.{type Element}
import lustre/element/html
import shared/api/types.{type Profile}
import ui/avatar

pub fn view(profiles: List(Profile)) -> Element(msg) {
  html.div([attribute.class("space-y-6")], [
    // Header
    html.div([attribute.class("mb-6")], [
      html.h2([attribute.class("text-2xl font-bold text-white mb-2")], [
        html.text("Attendees"),
      ]),
      html.p([attribute.class("text-zinc-400")], [
        html.text("Connect with other conference attendees"),
      ]),
    ]),
    // Profiles grid
    html.div(
      [attribute.class("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4")],
      list.map(profiles, view_profile_card),
    ),
  ])
}

fn view_profile_card(p: Profile) -> Element(msg) {
  let handle = option.unwrap(p.actor_handle, "")
  let display_name = option.unwrap(p.display_name, p.did)

  // Extract avatar URL from nested Blob structure
  let avatar_url = case p.avatar {
    option.Some(blob) -> option.Some(blob.url)
    option.None -> option.None
  }

  // Extract home town name
  let home_town_name = case p.home_town {
    option.Some(ht) -> ht.name
    option.None -> option.None
  }

  html.a(
    [
      attribute.href("/profile/" <> handle),
      attribute.class(
        "block p-4 bg-zinc-900 border border-zinc-800 rounded-lg hover:border-zinc-700 transition-colors",
      ),
    ],
    [
      html.div([attribute.class("flex items-start gap-4")], [
        // Avatar
        avatar.avatar(avatar_url, display_name, avatar.Md),
        // Profile info
        html.div([attribute.class("flex-1 min-w-0")], [
          // Display name
          html.h3(
            [attribute.class("text-lg font-semibold text-white truncate")],
            [
              html.text(display_name),
            ],
          ),
          // Handle
          case p.actor_handle {
            option.Some(h) ->
              html.p([attribute.class("text-sm text-zinc-400 truncate")], [
                html.text("@" <> h),
              ])
            option.None -> html.text("")
          },
          // Location
          case home_town_name {
            option.Some(name) ->
              html.p(
                [
                  attribute.class(
                    "text-xs text-zinc-500 mt-1 flex items-center gap-1",
                  ),
                ],
                [
                  html.span([attribute.class("text-zinc-600")], [html.text("📍")]),
                  html.text(name),
                ],
              )
            option.None -> html.text("")
          },
        ]),
      ]),
    ],
  )
}

pub fn view_loading() -> Element(msg) {
  html.div([attribute.class("text-center py-12")], [
    html.p([attribute.class("text-zinc-400")], [
      html.text("Loading attendees..."),
    ]),
  ])
}

pub fn view_error(error: String) -> Element(msg) {
  html.div([attribute.class("text-center py-12")], [
    html.h2([attribute.class("text-2xl font-bold text-white mb-4")], [
      html.text("Error"),
    ]),
    html.p([attribute.class("text-zinc-400")], [html.text(error)]),
  ])
}
