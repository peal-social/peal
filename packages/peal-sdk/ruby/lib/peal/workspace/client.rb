# frozen_string_literal: true

module Peal
  module Workspace
    class Client
      # @param client [Peal::Internal::Http::RawClient]
      #
      # @return [void]
      def initialize(client:)
        @client = client
      end

      # @return [Peal::Activity::Client]
      def activity
        @activity ||= Peal::Workspace::Activity::Client.new(client: @client)
      end

      # @return [Peal::APIKeys::Client]
      def api_keys
        @api_keys ||= Peal::Workspace::APIKeys::Client.new(client: @client)
      end

      # @return [Peal::Members::Client]
      def members
        @members ||= Peal::Workspace::Members::Client.new(client: @client)
      end

      # @return [Peal::Invitations::Client]
      def invitations
        @invitations ||= Peal::Workspace::Invitations::Client.new(client: @client)
      end

      # @return [Peal::Billing::Client]
      def billing
        @billing ||= Peal::Workspace::Billing::Client.new(client: @client)
      end

      # @return [Peal::Usage::Client]
      def usage
        @usage ||= Peal::Workspace::Usage::Client.new(client: @client)
      end
    end
  end
end
