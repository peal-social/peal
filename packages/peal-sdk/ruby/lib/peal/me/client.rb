# frozen_string_literal: true

module Peal
  module Me
    class Client
      # @param client [Peal::Internal::Http::RawClient]
      #
      # @return [void]
      def initialize(client:)
        @client = client
      end

      # Answers with the signed-in user and every workspace they belong to, with their role and permissions in each,
      # whether the account has two-step verification on and a password, and whether each workspace requires it (a
      # workspace that requires it refuses the user while it is off). Where the server measures the web app's use, it
      # also says how, with the person's choice about it. API keys belong to a workspace, not a user, and get 403.
      #
      # @param request_options [Hash]
      # @param _params [Hash]
      # @option request_options [String] :base_url
      # @option request_options [Hash{String => Object}] :additional_headers
      # @option request_options [Hash{String => Object}] :additional_query_parameters
      # @option request_options [Hash{String => Object}] :additional_body_parameters
      # @option request_options [Integer] :timeout_in_seconds
      #
      # @example
      #   client.me.get
      #
      # @return [Peal::Types::Me]
      def get(request_options: {}, **_params)
        request = Peal::Internal::JSON::Request.new(
          base_url: request_options[:base_url],
          method: "GET",
          path: "api/me",
          request_options: request_options
        )
        begin
          response = @client.send(request)
        rescue Net::HTTPRequestTimeout
          raise Peal::Errors::TimeoutError
        end
        code = response.code.to_i
        if code.between?(200, 299)
          (response.body.to_s.empty? ? nil : Peal::Types::Me.load(response.body))
        else
          error_class = Peal::Errors::ResponseError.subclass_for_code(code)
          error_types = {
            401 => Peal::Types::UnauthenticatedEncoded
          }
          error_body = Peal::Errors::ResponseError.load_error_body(code, response.body, error_types)
          raise error_class.new(response.body, code: code, body: error_body, headers: response.to_hash)
        end
      end

      # @return [Peal::Notices::Client]
      def notices
        @notices ||= Peal::Me::Notices::Client.new(client: @client)
      end

      # @return [Peal::NotificationPreferences::Client]
      def notification_preferences
        @notification_preferences ||= Peal::Me::NotificationPreferences::Client.new(client: @client)
      end
    end
  end
end
