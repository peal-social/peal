# frozen_string_literal: true

module Peal
  module Workspace
    module APIKeys
      class Client
        # @param client [Peal::Internal::Http::RawClient]
        #
        # @return [void]
        def initialize(client:)
          @client = client
        end

        # Lists the workspace's API keys, with the member who made each. Needs apiKey:read.
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
        #   client.workspace.api_keys.list
        #
        # @return [Array[Peal::Types::APIKey]]
        def list(request_options: {}, **_params)
          request = Peal::Internal::JSON::Request.new(
            base_url: request_options[:base_url],
            method: "GET",
            path: "api/v1/workspace/api-keys",
            request_options: request_options
          )
          begin
            response = @client.send(request)
          rescue Net::HTTPRequestTimeout
            raise Peal::Errors::TimeoutError
          end
          code = response.code.to_i
          if code.between?(200, 299)
            Peal::Internal::Types::Utils.coerce(Internal::Types::Array[Peal::Types::APIKey], (response.body.to_s.empty? ? nil : JSON.parse(response.body, symbolize_names: true)))
          else
            error_class = Peal::Errors::ResponseError.subclass_for_code(code)
            error_types = {
              401 => Peal::Types::UnauthenticatedEncoded
            }
            error_body = Peal::Errors::ResponseError.load_error_body(code, response.body, error_types)
            raise error_class.new(response.body, code: code, body: error_body, headers: response.to_hash)
          end
        end

        # Creates an API key for the workspace with some of the caller's permissions, and answers with the key itself,
        # which is not shown again. Needs apiKey:create, and a signed-in member: API keys cannot create keys. The key is
        # the caller's: it stops working once they leave the workspace, are removed or close their account, and once
        # their role no longer holds one of its permissions.
        #
        # @param request_options [Hash]
        # @param params [Peal::Workspace::APIKeys::Types::NewAPIKey]
        # @option request_options [String] :base_url
        # @option request_options [Hash{String => Object}] :additional_headers
        # @option request_options [Hash{String => Object}] :additional_query_parameters
        # @option request_options [Hash{String => Object}] :additional_body_parameters
        # @option request_options [Integer] :timeout_in_seconds
        #
        # @example
        #   client.workspace.api_keys.create(
        #     name: "name",
        #     permissions: ["activity:read"]
        #   )
        #
        # @return [Peal::Types::CreatedAPIKey]
        def create(request_options: {}, **params)
          params = Peal::Internal::Types::Utils.normalize_keys(params)
          request = Peal::Internal::JSON::Request.new(
            base_url: request_options[:base_url],
            method: "POST",
            path: "api/v1/workspace/api-keys",
            body: Peal::Workspace::APIKeys::Types::NewAPIKey.new(params).to_h,
            request_options: request_options,
            max_retries: 0
          )
          begin
            response = @client.send(request)
          rescue Net::HTTPRequestTimeout
            raise Peal::Errors::TimeoutError
          end
          code = response.code.to_i
          if code.between?(200, 299)
            (response.body.to_s.empty? ? nil : Peal::Types::CreatedAPIKey.load(response.body))
          else
            error_class = Peal::Errors::ResponseError.subclass_for_code(code)
            error_types = {
              401 => Peal::Types::UnauthenticatedEncoded
            }
            error_body = Peal::Errors::ResponseError.load_error_body(code, response.body, error_types)
            raise error_class.new(response.body, code: code, body: error_body, headers: response.to_hash)
          end
        end

        # Revokes an API key of the workspace: it stops working at once. Needs apiKey:delete.
        #
        # @param request_options [Hash]
        # @param params [Hash]
        # @option request_options [String] :base_url
        # @option request_options [Hash{String => Object}] :additional_headers
        # @option request_options [Hash{String => Object}] :additional_query_parameters
        # @option request_options [Hash{String => Object}] :additional_body_parameters
        # @option request_options [Integer] :timeout_in_seconds
        # @option params [String] :api_key_id
        #
        # @example
        #   client.workspace.api_keys.revoke(api_key_id: "apiKeyId")
        #
        # @return [untyped]
        def revoke(request_options: {}, **params)
          params = Peal::Internal::Types::Utils.normalize_keys(params)
          request = Peal::Internal::JSON::Request.new(
            base_url: request_options[:base_url],
            method: "DELETE",
            path: "api/v1/workspace/api-keys/#{URI.encode_uri_component(params[:api_key_id].to_s)}",
            request_options: request_options
          )
          begin
            response = @client.send(request)
          rescue Net::HTTPRequestTimeout
            raise Peal::Errors::TimeoutError
          end
          code = response.code.to_i
          return if code.between?(200, 299)

          error_class = Peal::Errors::ResponseError.subclass_for_code(code)
          error_types = {
            401 => Peal::Types::UnauthenticatedEncoded
          }
          error_body = Peal::Errors::ResponseError.load_error_body(code, response.body, error_types)
          raise error_class.new(response.body, code: code, body: error_body, headers: response.to_hash)
        end
      end
    end
  end
end
