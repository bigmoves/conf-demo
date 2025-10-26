import gleam/list
import gleam/option.{type Option}
import lustre/attribute
import lustre/element.{type Element}
import lustre/element/html
import shared/api/types.{type Profile}
import ui/avatar
import ui/button
import ui/icon

pub fn view(p: Profile, current_user_handle: Option(String)) -> Element(msg) {
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

  html.div([attribute.class("space-y-8")], [
    // Profile header
    html.div([attribute.class("flex items-start gap-6")], [
      // Avatar
      avatar.avatar(
        avatar_url,
        option.unwrap(p.display_name, p.did),
        avatar.Xl,
      ),

      // User info
      html.div([attribute.class("flex-1 space-y-2")], [
        // Display name
        html.h2([attribute.class("text-3xl font-bold text-white")], [
          html.text(option.unwrap(p.display_name, p.did)),
        ]),
        // Handle
        case p.actor_handle {
          option.Some(handle) ->
            html.p([attribute.class("text-zinc-300 text-base")], [
              html.text("@" <> handle),
            ])
          option.None -> html.div([], [])
        },
        // DID in muted text
        html.p([attribute.class("text-zinc-500 text-sm font-mono")], [
          html.text(p.did),
        ]),
        // Home town
        case home_town_name {
          option.Some(name) ->
            html.p([attribute.class("text-zinc-400 text-sm")], [
              html.text("📍 " <> name),
            ])
          option.None -> html.div([], [])
        },
      ]),

      // Edit button - only show if current user owns this profile
      case p.actor_handle, current_user_handle {
        option.Some(profile_handle), option.Some(user_handle)
          if profile_handle == user_handle
        ->
          button.icon_link(
            [attribute.href("/profile/" <> profile_handle <> "/edit")],
            button.IconLg,
            [icon.icon("settings", icon.Lg, [])],
          )
        _, _ -> element.none()
      },
    ]),

    // Profile sections
    html.div([attribute.class("space-y-6 pt-6 border-t border-zinc-800")], [
      // About section (if description exists)
      case p.description {
        option.Some(desc) ->
          html.div([attribute.class("space-y-3")], [
            html.h3([attribute.class("text-lg font-semibold text-white")], [
              html.text("About"),
            ]),
            html.p([attribute.class("text-zinc-400")], [html.text(desc)]),
          ])
        option.None -> html.div([], [])
      },

      // Interests section
      case p.interests {
        option.Some(interests) ->
          case interests {
            [] -> html.div([], [])
            _ ->
              html.div([attribute.class("space-y-3")], [
                html.h3([attribute.class("text-lg font-semibold text-white")], [
                  html.text("Interests"),
                ]),
                html.div([attribute.class("flex flex-wrap gap-2")], {
                  list.map(interests, fn(interest) {
                    html.span(
                      [
                        attribute.class(
                          "px-3 py-1 bg-zinc-800 text-zinc-300 rounded-full text-sm",
                        ),
                      ],
                      [html.text(interest)],
                    )
                  })
                }),
              ])
          }
        option.None -> html.div([], [])
      },
    ]),
  ])
}
