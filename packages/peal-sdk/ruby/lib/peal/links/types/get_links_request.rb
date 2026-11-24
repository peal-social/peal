# frozen_string_literal: true

module Peal
  module Links
    module Types
      class GetLinksRequest < Internal::Types::Model
        field :link_id, -> { String }, optional: false, nullable: false, api_name: "linkId"

        field :from, -> { String }, optional: true, nullable: false

        field :to, -> { String }, optional: true, nullable: false
      end
    end
  end
end
