import client/init
import client/update
import client/view
import lustre

pub fn main() {
  let app = lustre.application(init.init, update.update, view.view)
  let assert Ok(_) = lustre.start(app, "#app", Nil)

  Nil
}
