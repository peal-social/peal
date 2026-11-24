# frozen_string_literal: true

module Peal
  module Posts
    module Types
      class PostImport < Internal::Types::Model
        field :idempotency_key, -> { String }, optional: true, nullable: false, api_name: "idempotency-key"

        field :csv, -> { String }, optional: false, nullable: false

        field :dry_run, -> { Internal::Types::Boolean }, optional: true, nullable: false, api_name: "dryRun"
      end
    end
  end
end
