import gleam/option.{type Option}
import lustre/attribute
import lustre/element.{type Element}
import lustre/element/html
import ui/button
import ui/layout

pub fn view(current_user: Option(layout.User)) -> Element(msg) {
  html.div([attribute.class("flex items-center justify-center min-h-[60vh]")], [
    // Centered card
    html.div(
      [
        attribute.class(
          "w-full max-w-md p-8 bg-zinc-900 border border-zinc-800 rounded-lg space-y-6 text-center",
        ),
      ],
      case current_user {
        option.Some(user) -> [
          html.p([attribute.class("text-zinc-400 mb-4")], [
            html.text("Welcome back! Edit your profile to connect with other attendees"),
          ]),
          html.a([attribute.href("/profile/" <> user.handle <> "/edit")], [
            button.button(
              [attribute.class("w-full justify-center")],
              button.Primary,
              button.Md,
              [html.text("Edit profile")],
            ),
          ]),
        ]
        option.None -> [
          html.p([attribute.class("text-zinc-400")], [
            html.text("Create your profile to connect with other attendees"),
          ]),
          html.a([attribute.href("/login")], [
            button.button(
              [attribute.class("w-full justify-center")],
              button.Primary,
              button.Md,
              [html.text("Sign in to create your profile")],
            ),
          ]),
        ]
      },
    ),
  ])
}
