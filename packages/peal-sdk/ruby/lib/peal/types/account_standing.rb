# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    class AccountStanding < Internal::Types::Model
      extend Peal::Internal::Types::Union

      discriminant :_tag

      member -> { Peal::Types::AccountStandingUnrestricted }, key: "unrestricted"

      member -> { Peal::Types::AccountStandingRead }, key: "read"

      member -> { Peal::Types::AccountStandingUnread }, key: "unread"
    end
  end
end
