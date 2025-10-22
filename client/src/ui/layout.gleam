import gleam/option.{type Option}
import lustre/attribute
import lustre/element.{type Element}
import lustre/element/html

pub type User {
  User(name: Option(String), handle: String)
}

pub fn layout(
  user: Option(User),
  children: List(Element(msg)),
) -> Element(msg) {
  html.div([attribute.class("min-h-screen bg-zinc-950 text-zinc-300 font-mono")], [
    html.div([attribute.class("max-w-4xl mx-auto px-6 py-12")], [
      // Header
      html.div([attribute.class("border-b border-zinc-800 pb-4")], [
        html.div([attribute.class("flex items-end justify-between")], [
          // Logo/Title
          html.a(
            [
              attribute.href("/"),
              attribute.class("flex items-center gap-3 hover:opacity-80 transition-opacity"),
            ],
            [
              html.div([], [
                html.h1([attribute.class("text-2xl font-bold text-white")], [
                  html.text("atmosphere conf"),
                ]),
              ]),
            ],
          ),
          // Navigation
          html.div([attribute.class("flex gap-4 text-xs items-center")], [
            view_nav(user),
          ]),
        ]),
      ]),
      // Spacer
      html.div([attribute.class("mb-8")], []),
      // Content
      html.div([], children),
    ]),
  ])
}

fn view_nav(user: Option(User)) -> Element(msg) {
  case user {
    option.Some(u) -> {
      let display_name = case u.name {
        option.Some(name) -> name
        option.None -> "@" <> u.handle
      }

      html.div([attribute.class("flex gap-4 items-center")], [
        html.a(
          [
            attribute.href("/profile/" <> u.handle),
            attribute.class("px-2 py-1 text-zinc-400 hover:text-zinc-200 transition-colors"),
          ],
          [html.text(display_name)],
        ),
        html.form(
          [
            attribute.action("/logout"),
            attribute.method("post"),
            attribute.class("inline"),
          ],
          [
            html.button(
              [
                attribute.type_("submit"),
                attribute.class("px-2 py-1 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"),
              ],
              [html.text("Sign Out")],
            ),
          ],
        ),
      ])
    }

    option.None ->
      html.a(
        [
          attribute.href("/login"),
          attribute.class("px-2 py-1 text-zinc-500 hover:text-zinc-300 transition-colors"),
        ],
        [html.text("Sign In")],
      )
  }
}
