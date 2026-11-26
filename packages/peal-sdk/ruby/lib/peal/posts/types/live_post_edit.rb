# frozen_string_literal: true

module Peal
  module Posts
    module Types
      class LivePostEdit < Internal::Types::Model
        field :post_id, -> { String }, optional: false, nullable: false, api_name: "postId"

        field :target_id, -> { String }, optional: false, nullable: false, api_name: "targetId"

        field :wait, -> { String }, optional: true, nullable: false

        field :body, -> { Peal::Types::RichText }, optional: true, nullable: false

        field :options, -> { Peal::Types::TargetOptions }, optional: true, nullable: false

        field :part, -> { Integer }, optional: true, nullable: false

        field :text, -> { String }, optional: true, nullable: false
      end
    end
  end
end
