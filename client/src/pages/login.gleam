import lustre/attribute
import lustre/element.{type Element}
import lustre/element/html
import ui/button
import ui/input

pub fn view() -> Element(msg) {
  html.div([attribute.class("flex items-center justify-center min-h-[60vh]")], [
    html.div([attribute.class("w-full max-w-[300px] space-y-4")], [
      // Login form
      html.form(
        [
          attribute.method("POST"),
          attribute.action("/oauth/authorize"),
          attribute.class("space-y-4"),
        ],
        [
          // Input field
          html.div([], [
            html.label(
              [
                attribute.for("loginHint"),
                attribute.class(
                  "block text-sm font-medium text-zinc-400 mb-2",
                ),
              ],
              [html.text("Handle or PDS Host")],
            ),
            input.input([
              attribute.id("loginHint"),
              attribute.name("loginHint"),
              attribute.type_("text"),
              attribute.placeholder("user.bsky.social"),
              attribute.attribute("required", "true"),
            ]),
          ]),
          // Submit button
          button.button(
            [
              attribute.type_("submit"),
              attribute.class("w-full justify-center"),
            ],
            button.Primary,
            button.Md,
            [html.text("Sign In")],
          ),
        ],
      ),
      // Help text
      html.div([attribute.class("text-xs text-zinc-500")], [
        html.p([], [html.text("Examples: user.bsky.social, pds.example.com")]),
        html.p([attribute.class("mt-2")], [
          html.text("Don't have an account? "),
          html.a(
            [
              attribute.href("https://bsky.app"),
              attribute.target("_blank"),
              attribute.attribute("rel", "noopener noreferrer"),
              attribute.class(
                "text-zinc-400 hover:text-zinc-300 underline",
              ),
            ],
            [html.text("Create one on Bluesky")],
          ),
        ]),
      ]),
    ]),
  ])
}
