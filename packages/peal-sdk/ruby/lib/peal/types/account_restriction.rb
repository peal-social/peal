# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    class AccountRestriction < Internal::Types::Model
      extend Peal::Internal::Types::Union

      discriminant :_tag

      member -> { Peal::Types::AccountRestrictionOptionValues }, key: "optionValues"

      member -> { Peal::Types::AccountRestrictionOptionFixed }, key: "optionFixed"

      member -> { Peal::Types::AccountRestrictionVideoDuration }, key: "videoDuration"

      member -> { Peal::Types::AccountRestrictionMediaTypesRefused }, key: "mediaTypesRefused"

      member -> { Peal::Types::AccountRestrictionOptionNeedsReconnect }, key: "optionNeedsReconnect"

      member -> { Peal::Types::AccountRestrictionPartsNeedReconnect }, key: "partsNeedReconnect"
    end
  end
end
