# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    class TextOverride < Internal::Types::Model
      field :body, -> { Peal::Types::RichText }, optional: true, nullable: false

      field :body_markdown, -> { String }, optional: true, nullable: false, api_name: "bodyMarkdown"

      field :channel_id, -> { String }, optional: false, nullable: false, api_name: "channelId"

      field :media, -> { Internal::Types::Array[Peal::Types::MediaAttachment] }, optional: true, nullable: false

      field :text, -> { String }, optional: false, nullable: false
    end
  end
end
