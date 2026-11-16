# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    # How a post goes out on a Slack channel, on every part of a thread. Scheduling needs none of them.
    class SlackOptions < Internal::Types::Model
      field :unfurl_links, -> { Internal::Types::Boolean }, optional: true, nullable: false, api_name: "unfurlLinks"
    end
  end
end
