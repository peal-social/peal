# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    # How a post goes out on a Discord channel, on every part of a thread. Scheduling needs none of them; a forum
    # channel needs a thread name.
    class DiscordOptions < Internal::Types::Model
      field :mentions, -> { Internal::Types::Boolean }, optional: true, nullable: false

      field :silent, -> { Internal::Types::Boolean }, optional: true, nullable: false

      field :suppress_embeds, -> { Internal::Types::Boolean }, optional: true, nullable: false, api_name: "suppressEmbeds"

      field :thread_name, -> { String }, optional: true, nullable: false, api_name: "threadName"
    end
  end
end
