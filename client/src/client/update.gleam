import cache
import client/effects
import client/model.{type Model, type Msg, Model}
import gleam/int
import gleam/io
import gleam/option
import lustre/effect.{type Effect}
import modem
import pages/profile_edit
import query
import ui/location_input

// UPDATE ----------------------------------------------------------------------

pub fn update(current_model: Model, msg: Msg) -> #(Model, Effect(Msg)) {
  case msg {
    model.CurrentUserFetched(result) -> {
      let current_user = case result {
        Ok(user) -> option.Some(user)
        Error(_) -> option.None
      }
      #(Model(..current_model, current_user: current_user), effect.none())
    }

    model.QueryStarted(query_key) -> {
      // Mark query as fetching in cache
      let query_key_str = query.to_string(query_key)
      let stale_time = query.stale_time(query_key)
      let updated_cache =
        cache.set_query_fetching(current_model.cache, query_key_str, stale_time)
      #(Model(..current_model, cache: updated_cache), effect.none())
    }

    model.ProfileQuerySuccess(handle, profile) -> {
      io.println("Profile query success for: " <> handle)
      // Update cache with profile entity
      let updated_cache = cache.set_profile(current_model.cache, profile)

      // Mark query as successful
      let query_key_str = query.to_string(query.ProfileQuery(handle))
      let current_time = effects.get_current_time_ms()
      let stale_time = query.stale_time(query.ProfileQuery(handle))
      let updated_cache =
        cache.set_query_success(
          updated_cache,
          query_key_str,
          current_time,
          stale_time,
        )

      // Update form data if we're on edit page for this profile
      let edit_form_data = case current_model.route {
        model.ProfileEdit(h) if h == handle ->
          profile_edit.init_form_data(option.Some(profile))
        _ -> current_model.edit_form_data
      }

      #(
        Model(
          ..current_model,
          cache: updated_cache,
          edit_form_data: edit_form_data,
        ),
        effect.none(),
      )
    }

    model.ProfileQueryError(handle, error) -> {
      io.println("Profile query error for " <> handle <> ": " <> error)
      let query_key_str = query.to_string(query.ProfileQuery(handle))
      let current_time = effects.get_current_time_ms()
      let stale_time = query.stale_time(query.ProfileQuery(handle))
      let updated_cache =
        cache.set_query_error(
          current_model.cache,
          query_key_str,
          error,
          current_time,
          stale_time,
        )
      #(Model(..current_model, cache: updated_cache), effect.none())
    }

    model.AttendeesQuerySuccess(profiles) -> {
      io.println(
        "Attendees query success: " <> int.to_string(profiles |> list_length),
      )

      // Hydrate cache with profiles - this sets entities, attendees query,
      // AND individual profile queries as fresh (avoids refetch on click)
      let current_time = effects.get_current_time_ms()
      let stale_time = query.stale_time(query.ProfileQuery(""))
      let updated_cache =
        cache.hydrate_profiles(
          current_model.cache,
          profiles,
          current_time,
          stale_time,
        )

      #(Model(..current_model, cache: updated_cache), effect.none())
    }

    model.AttendeesQueryError(error) -> {
      io.println("Attendees query error: " <> error)
      let query_key_str = query.to_string(query.AttendeesQuery)
      let current_time = effects.get_current_time_ms()
      let stale_time = query.stale_time(query.AttendeesQuery)
      let updated_cache =
        cache.set_query_error(
          current_model.cache,
          query_key_str,
          error,
          current_time,
          stale_time,
        )
      #(Model(..current_model, cache: updated_cache), effect.none())
    }

    model.UserNavigatedTo(route: route) -> {
      let updated_model = Model(..current_model, route: route)
      let current_time = effects.get_current_time_ms()

      // Determine what to fetch based on route and cache state
      case route {
        model.Attendees -> {
          io.println("Navigating to attendees")
          // Check if user is logged in
          case updated_model.current_user {
            option.None -> {
              io.println("Not authenticated, redirecting to login")
              #(updated_model, modem.push("/login", option.None, option.None))
            }
            option.Some(_) -> {
              // Check if attendees data is stale
              let query_key_str = query.to_string(query.AttendeesQuery)
              let is_stale =
                cache.is_query_stale(
                  updated_model.cache,
                  query_key_str,
                  current_time,
                )

              case is_stale {
                True -> #(updated_model, effects.fetch_attendees_with_cache())
                False -> #(updated_model, effect.none())
              }
            }
          }
        }
        model.Profile(handle: handle) -> {
          io.println("Navigating to profile: " <> handle)
          // Check if profile is in cache and fresh
          let query_key_str = query.to_string(query.ProfileQuery(handle))
          let is_stale =
            cache.is_query_stale(
              updated_model.cache,
              query_key_str,
              current_time,
            )

          case is_stale {
            True -> #(updated_model, effects.fetch_profile_with_cache(handle))
            False -> #(updated_model, effect.none())
          }
        }
        model.ProfileEdit(handle: handle) -> {
          io.println("Navigating to profile edit: " <> handle)

          // Check if current user is authorized
          let is_authorized = case updated_model.current_user {
            option.Some(user) if user.handle == handle -> True
            _ -> False
          }

          case is_authorized {
            False -> {
              io.println(
                "Unauthorized edit attempt, redirecting to profile view",
              )
              #(
                updated_model,
                modem.push("/profile/" <> handle, option.None, option.None),
              )
            }
            True -> {
              // Get profile from cache
              let profile_from_cache =
                cache.get_profile(updated_model.cache, handle)
              let form_data = profile_edit.init_form_data(profile_from_cache)
              let model_with_form =
                Model(..updated_model, edit_form_data: form_data)

              // Check if we need to fetch fresh data
              let query_key_str = query.to_string(query.ProfileQuery(handle))
              let is_stale =
                cache.is_query_stale(
                  model_with_form.cache,
                  query_key_str,
                  current_time,
                )

              case is_stale {
                True -> #(
                  model_with_form,
                  effects.fetch_profile_with_cache(handle),
                )
                False -> #(model_with_form, effect.none())
              }
            }
          }
        }
        _ -> #(updated_model, effect.none())
      }
    }

    // Optimistic mutation messages
    model.ProfileMutationOptimistic(handle, updated) -> {
      io.println("Applying optimistic update for: " <> handle)
      let updated_cache =
        cache.apply_optimistic_profile_update(
          current_model.cache,
          handle,
          updated,
        )
      #(Model(..current_model, cache: updated_cache), effect.none())
    }

    model.ProfileMutationSuccess(handle, updated) -> {
      io.println("Mutation success for: " <> handle)
      // Commit the optimistic update and update with server data
      let committed_cache =
        cache.commit_optimistic_update(current_model.cache, handle)
      let updated_cache = cache.set_profile(committed_cache, updated)

      // Invalidate related queries to trigger refetch if needed
      let query_key_str = query.to_string(query.ProfileQuery(handle))
      let current_time = effects.get_current_time_ms()
      let stale_time = query.stale_time(query.ProfileQuery(handle))
      let updated_cache =
        cache.set_query_success(
          updated_cache,
          query_key_str,
          current_time,
          stale_time,
        )

      #(Model(..current_model, cache: updated_cache), effect.none())
    }

    model.ProfileMutationError(handle, error) -> {
      io.println("Mutation error for " <> handle <> ": " <> error)
      // Rollback the optimistic update
      let updated_cache =
        cache.rollback_optimistic_update(current_model.cache, handle)
      #(Model(..current_model, cache: updated_cache), effect.none())
    }

    model.ProfileEditMsg(edit_msg) -> {
      case edit_msg {
        profile_edit.DisplayNameUpdated(value) -> {
          let form_data =
            profile_edit.FormData(
              ..current_model.edit_form_data,
              display_name: value,
            )
          #(Model(..current_model, edit_form_data: form_data), effect.none())
        }
        profile_edit.DescriptionUpdated(value) -> {
          let form_data =
            profile_edit.FormData(
              ..current_model.edit_form_data,
              description: value,
            )
          #(Model(..current_model, edit_form_data: form_data), effect.none())
        }
        profile_edit.LocationInputMsg(location_msg) -> {
          let #(location_model, location_effect) =
            location_input.update(
              current_model.edit_form_data.location_input,
              location_msg,
            )

          let form_data =
            profile_edit.FormData(
              ..current_model.edit_form_data,
              location_input: location_model,
            )

          #(
            Model(..current_model, edit_form_data: form_data),
            location_effect
              |> effect.map(fn(msg) {
                model.ProfileEditMsg(profile_edit.LocationInputMsg(msg))
              }),
          )
        }
        profile_edit.InterestsUpdated(value) -> {
          let form_data =
            profile_edit.FormData(
              ..current_model.edit_form_data,
              interests: value,
            )
          #(Model(..current_model, edit_form_data: form_data), effect.none())
        }
        profile_edit.AvatarFileChanged(_files) -> {
          // Trigger an effect to process the file from the input element
          #(
            current_model,
            effects.process_file_from_input_effect("avatar-upload"),
          )
        }
        profile_edit.AvatarFileProcessed(file_data) -> {
          let form_data =
            profile_edit.FormData(
              ..current_model.edit_form_data,
              avatar_preview_url: option.Some(file_data.preview_url),
              avatar_file_data: option.Some(file_data),
            )
          #(Model(..current_model, edit_form_data: form_data), effect.none())
        }
        profile_edit.FormSubmitted -> {
          // Clear any existing messages and set saving state
          let form_data =
            profile_edit.FormData(
              ..current_model.edit_form_data,
              is_saving: True,
              success_message: option.None,
              error_message: option.None,
            )
          let updated_model = Model(..current_model, edit_form_data: form_data)

          // Get the handle from the route
          case updated_model.route {
            model.ProfileEdit(handle: handle) -> {
              #(
                updated_model,
                effects.save_profile_effect(
                  handle,
                  updated_model.edit_form_data,
                ),
              )
            }
            _ -> #(updated_model, effect.none())
          }
        }
        profile_edit.SaveCompleted(result) -> {
          case result {
            Ok(updated_profile) -> {
              // Update form data with success message
              let form_data =
                profile_edit.FormData(
                  ..current_model.edit_form_data,
                  is_saving: False,
                  success_message: option.Some("Profile updated successfully!"),
                  error_message: option.None,
                )

              // Dispatch mutation success (handled by ProfileMutationSuccess)
              case updated_profile.actor_handle {
                option.Some(handle) -> {
                  #(
                    Model(..current_model, edit_form_data: form_data),
                    effect.from(fn(dispatch) {
                      dispatch(model.ProfileMutationSuccess(
                        handle,
                        updated_profile,
                      ))
                      Nil
                    }),
                  )
                }
                option.None -> #(
                  Model(..current_model, edit_form_data: form_data),
                  effect.none(),
                )
              }
            }
            Error(err) -> {
              // Rollback optimistic update and show error
              let form_data =
                profile_edit.FormData(
                  ..current_model.edit_form_data,
                  is_saving: False,
                  success_message: option.None,
                  error_message: option.Some(err),
                )

              case current_model.route {
                model.ProfileEdit(handle) -> {
                  #(
                    Model(..current_model, edit_form_data: form_data),
                    effect.from(fn(dispatch) {
                      dispatch(model.ProfileMutationError(handle, err))
                      Nil
                    }),
                  )
                }
                _ -> #(
                  Model(..current_model, edit_form_data: form_data),
                  effect.none(),
                )
              }
            }
          }
        }
        profile_edit.CancelClicked -> {
          // Navigate back to profile page
          case current_model.route {
            model.ProfileEdit(handle: handle) -> {
              #(
                current_model,
                modem.push("/profile/" <> handle, option.None, option.None),
              )
            }
            _ -> #(current_model, effect.none())
          }
        }
      }
    }
  }
}

// Helper function to get list length
fn list_length(list: List(a)) -> Int {
  case list {
    [] -> 0
    [_, ..rest] -> 1 + list_length(rest)
  }
}
