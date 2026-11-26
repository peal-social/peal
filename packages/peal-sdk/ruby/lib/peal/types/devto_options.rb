# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    # How a post goes out on DEV, as an article. Scheduling needs `title`; at most 4 tags, each letters and digits.
    class DevtoOptions < Internal::Types::Model
      field :cover_media_id, -> { String }, optional: true, nullable: false, api_name: "coverMediaId"

      field :excerpt, -> { String }, optional: true, nullable: false

      field :site_status, -> { Peal::Types::SiteStatusOption }, optional: true, nullable: false, api_name: "siteStatus"

      field :tags, -> { Internal::Types::Array[String] }, optional: true, nullable: false

      field :title, -> { String }, optional: true, nullable: false
    end
  end
end
