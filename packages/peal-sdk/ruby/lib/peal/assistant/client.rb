# frozen_string_literal: true

module Peal
  module Assistant
    class Client
      # @param client [Peal::Internal::Http::RawClient]
      #
      # @return [void]
      def initialize(client:)
        @client = client
      end

      # Tells whether the assistant writes for the workspace, so clients show it or hide it, and who writes (`source`:
      # the workspace's own text provider, the server's language model, or nobody), who makes the workspace's images
      # (`images.source`: the workspace's own provider, the server's image model, or nobody) and what one costs, and how
      # many requests the workspace has left today. On a server that bills, `month` and `images.month` tell the billing
      # account's month of the server's models (included, used, price and ceiling), and `reason` `paymentMethod` why
      # they are off without a payment method. Needs assistant:use.
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
      #   client.assistant.status
      #
      # @return [Peal::Types::AssistantStatus]
      def status(request_options: {}, **_params)
        request = Peal::Internal::JSON::Request.new(
          base_url: request_options[:base_url],
          method: "GET",
          path: "api/v1/assistant",
          request_options: request_options
        )
        begin
          response = @client.send(request)
        rescue Net::HTTPRequestTimeout
          raise Peal::Errors::TimeoutError
        end
        code = response.code.to_i
        if code.between?(200, 299)
          (response.body.to_s.empty? ? nil : Peal::Types::AssistantStatus.load(response.body))
        else
          error_class = Peal::Errors::ResponseError.subclass_for_code(code)
          error_types = {
            401 => Peal::Types::UnauthenticatedEncoded
          }
          error_body = Peal::Errors::ResponseError.load_error_body(code, response.body, error_types)
          raise error_class.new(response.body, code: code, body: error_body, headers: response.to_hash)
        end
      end

      # Asks the language model to rewrite, shorten or translate a post's text, to suggest hashtags for it, or to write
      # a first post from a subject (`write`), and answers once the whole suggestion is checked. The text is sent to the
      # model as data, never as instructions. When the workspace brought its own text provider (`source` `workspace` in
      # the status), the text goes there, with the workspace's key, and the request costs none of the workspace's daily
      # requests, on any plan, within a number of such requests a day (OwnTextLimitReached past it) and a few at once
      # (TextProviderBusy past them); if that provider refuses, the answer is TextProviderRefused and the server's model
      # is never asked instead. Otherwise, on a server that does not bill, each request counts toward the workspace's
      # daily quota, unless the model's provider could not be reached (AssistantQuotaExceeded past it). On a server that
      # bills, the server's model needs a payment method on the billing account (UsageAllowanceReached
      # `paymentMethodRequired` without one, before anything is asked): each request counts toward the month's allowance
      # across the account's workspaces (the status's `month`), then is billed at its price up to the ceiling the
      # account set (UsageAllowanceReached `ceilingReached`); a request that brings no suggestion, a timeout included,
      # is not counted. Needs assistant:use.
      #
      # @param request_options [Hash]
      # @param params [Peal::Assistant::Types::SuggestionRequest]
      # @option request_options [String] :base_url
      # @option request_options [Hash{String => Object}] :additional_headers
      # @option request_options [Hash{String => Object}] :additional_query_parameters
      # @option request_options [Hash{String => Object}] :additional_body_parameters
      # @option request_options [Integer] :timeout_in_seconds
      #
      # @example
      #   client.assistant.suggest(text: "text")
      #
      # @return [Peal::Types::Suggestion]
      def suggest(request_options: {}, **params)
        params = Peal::Internal::Types::Utils.normalize_keys(params)
        request = Peal::Internal::JSON::Request.new(
          base_url: request_options[:base_url],
          method: "POST",
          path: "api/v1/assistant/suggestions",
          body: Peal::Assistant::Types::SuggestionRequest.new(params).to_h,
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
          (response.body.to_s.empty? ? nil : Peal::Types::Suggestion.load(response.body))
        else
          error_class = Peal::Errors::ResponseError.subclass_for_code(code)
          error_types = {
            401 => Peal::Types::UnauthenticatedEncoded
          }
          error_body = Peal::Errors::ResponseError.load_error_body(code, response.body, error_types)
          raise error_class.new(response.body, code: code, body: error_body, headers: response.to_hash)
        end
      end

      # Reads the image provider the workspace brought, a provider Peal knows by name (OpenAI, Google Gemini, xAI,
      # Together AI) or an endpoint that speaks the OpenAI images API (`POST {baseUrl}/images/generations`), whose
      # images then spend none of the workspace's daily assistant requests: its address and model, never its key, or
      # null. Needs assistant:configure, which no OAuth client holds but Peal's command line (since 2026-11-13; before,
      # any client with workspace:write did).
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
      #   client.assistant.image_provider
      #
      # @return [Peal::Types::ImageProviderSetting]
      def image_provider(request_options: {}, **_params)
        request = Peal::Internal::JSON::Request.new(
          base_url: request_options[:base_url],
          method: "GET",
          path: "api/v1/assistant/image-provider",
          request_options: request_options
        )
        begin
          response = @client.send(request)
        rescue Net::HTTPRequestTimeout
          raise Peal::Errors::TimeoutError
        end
        code = response.code.to_i
        if code.between?(200, 299)
          (response.body.to_s.empty? ? nil : Peal::Types::ImageProviderSetting.load(response.body))
        else
          error_class = Peal::Errors::ResponseError.subclass_for_code(code)
          error_types = {
            401 => Peal::Types::UnauthenticatedEncoded
          }
          error_body = Peal::Errors::ResponseError.load_error_body(code, response.body, error_types)
          raise error_class.new(response.body, code: code, body: error_body, headers: response.to_hash)
        end
      end

      # Sets the image provider the workspace brings, a provider Peal knows by name (OpenAI, Google Gemini, xAI,
      # Together AI) or an endpoint that speaks the OpenAI images API (`POST {baseUrl}/images/generations`), whose
      # images then spend none of the workspace's daily assistant requests. The workspace's image prompts then go to
      # `baseUrl` (the provider's own address when left out) with `apiKey`, through the API `provider` names
      # (`openai-compatible` when left out); the images still take room in the plan's media storage. Peal keeps the key
      # encrypted for this workspace and this address, never shows it again, and never sends it to another address:
      # `apiKey` may be left out to keep the stored one only while `baseUrl` stays exactly the same (to change the model
      # alone). The address must be public HTTPS; it is checked now, and before every call. The provider is not called:
      # the first image tells whether the settings work. Needs assistant:configure, which no OAuth client holds but
      # Peal's command line (since 2026-11-13; before, any client with workspace:write did).
      #
      # @param request_options [Hash]
      # @param params [Peal::Assistant::Types::ImageProviderChange]
      # @option request_options [String] :base_url
      # @option request_options [Hash{String => Object}] :additional_headers
      # @option request_options [Hash{String => Object}] :additional_query_parameters
      # @option request_options [Hash{String => Object}] :additional_body_parameters
      # @option request_options [Integer] :timeout_in_seconds
      #
      # @example
      #   client.assistant.set_image_provider(model: "model")
      #
      # @return [Peal::Types::ImageProvider]
      def set_image_provider(request_options: {}, **params)
        params = Peal::Internal::Types::Utils.normalize_keys(params)
        request = Peal::Internal::JSON::Request.new(
          base_url: request_options[:base_url],
          method: "PUT",
          path: "api/v1/assistant/image-provider",
          body: Peal::Assistant::Types::ImageProviderChange.new(params).to_h,
          request_options: request_options
        )
        begin
          response = @client.send(request)
        rescue Net::HTTPRequestTimeout
          raise Peal::Errors::TimeoutError
        end
        code = response.code.to_i
        if code.between?(200, 299)
          (response.body.to_s.empty? ? nil : Peal::Types::ImageProvider.load(response.body))
        else
          error_class = Peal::Errors::ResponseError.subclass_for_code(code)
          error_types = {
            401 => Peal::Types::UnauthenticatedEncoded
          }
          error_body = Peal::Errors::ResponseError.load_error_body(code, response.body, error_types)
          raise error_class.new(response.body, code: code, body: error_body, headers: response.to_hash)
        end
      end

      # Removes the workspace's image provider and its key: images are made by the server's image model again, if it has
      # one, and cost the workspace's daily requests. Needs assistant:configure, which no OAuth client holds but Peal's
      # command line (since 2026-11-13; before, any client with workspace:write did).
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
      #   client.assistant.remove_image_provider
      #
      # @return [untyped]
      def remove_image_provider(request_options: {}, **_params)
        request = Peal::Internal::JSON::Request.new(
          base_url: request_options[:base_url],
          method: "DELETE",
          path: "api/v1/assistant/image-provider",
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

      # Reads the text provider the workspace brought, Anthropic's Messages API or an endpoint that speaks the OpenAI
      # chat completions API, whose suggestions then spend none of the workspace's daily assistant requests: the API it
      # speaks, its address and model, never its key, or null. Needs assistant:configure.
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
      #   client.assistant.text_provider
      #
      # @return [Peal::Types::TextProviderSetting]
      def text_provider(request_options: {}, **_params)
        request = Peal::Internal::JSON::Request.new(
          base_url: request_options[:base_url],
          method: "GET",
          path: "api/v1/assistant/text-provider",
          request_options: request_options
        )
        begin
          response = @client.send(request)
        rescue Net::HTTPRequestTimeout
          raise Peal::Errors::TimeoutError
        end
        code = response.code.to_i
        if code.between?(200, 299)
          (response.body.to_s.empty? ? nil : Peal::Types::TextProviderSetting.load(response.body))
        else
          error_class = Peal::Errors::ResponseError.subclass_for_code(code)
          error_types = {
            401 => Peal::Types::UnauthenticatedEncoded
          }
          error_body = Peal::Errors::ResponseError.load_error_body(code, response.body, error_types)
          raise error_class.new(response.body, code: code, body: error_body, headers: response.to_hash)
        end
      end

      # Sets the text provider the workspace brings, Anthropic's Messages API or an endpoint that speaks the OpenAI chat
      # completions API, whose suggestions then spend none of the workspace's daily assistant requests. The workspace's
      # drafts, and the subjects of the posts it asks the assistant to write, then go to `baseUrl` with `apiKey`, under
      # that provider's terms. Peal keeps the key encrypted for this workspace and this address, never shows it again,
      # and never sends it to another address: `apiKey` may be left out to keep the stored one only while `baseUrl`
      # stays exactly the same (to change the model alone). The address must be public HTTPS; it is checked now, and
      # before every call. A provider that writes no text (ElevenLabs, fal) is AiCapabilityNotOffered. The provider is
      # not called: test it with `POST .../text-provider/test`. Needs assistant:configure, which no OAuth client holds
      # but Peal's command line.
      #
      # @param request_options [Hash]
      # @param params [Peal::Assistant::Types::TextProviderChange]
      # @option request_options [String] :base_url
      # @option request_options [Hash{String => Object}] :additional_headers
      # @option request_options [Hash{String => Object}] :additional_query_parameters
      # @option request_options [Hash{String => Object}] :additional_body_parameters
      # @option request_options [Integer] :timeout_in_seconds
      #
      # @example
      #   client.assistant.set_text_provider(model: "model")
      #
      # @return [Peal::Types::TextProvider]
      def set_text_provider(request_options: {}, **params)
        params = Peal::Internal::Types::Utils.normalize_keys(params)
        request = Peal::Internal::JSON::Request.new(
          base_url: request_options[:base_url],
          method: "PUT",
          path: "api/v1/assistant/text-provider",
          body: Peal::Assistant::Types::TextProviderChange.new(params).to_h,
          request_options: request_options
        )
        begin
          response = @client.send(request)
        rescue Net::HTTPRequestTimeout
          raise Peal::Errors::TimeoutError
        end
        code = response.code.to_i
        if code.between?(200, 299)
          (response.body.to_s.empty? ? nil : Peal::Types::TextProvider.load(response.body))
        else
          error_class = Peal::Errors::ResponseError.subclass_for_code(code)
          error_types = {
            401 => Peal::Types::UnauthenticatedEncoded
          }
          error_body = Peal::Errors::ResponseError.load_error_body(code, response.body, error_types)
          raise error_class.new(response.body, code: code, body: error_body, headers: response.to_hash)
        end
      end

      # Removes the workspace's text provider and its key: the server's language model writes again, if it has one,
      # within the workspace's daily requests. Needs assistant:configure.
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
      #   client.assistant.remove_text_provider
      #
      # @return [untyped]
      def remove_text_provider(request_options: {}, **_params)
        request = Peal::Internal::JSON::Request.new(
          base_url: request_options[:base_url],
          method: "DELETE",
          path: "api/v1/assistant/text-provider",
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

      # Sends the workspace's text provider one short request, a rewrite of a fixed sentence, as a member's request
      # would go, and answers 204 once the provider gave a suggestion the assistant can use. Otherwise the answer says
      # why, as a suggestion's would: TextProviderRefused (its settings, a redirect, its address or its key) or
      # AssistantFailed (unreachable, timed out, declined, or an answer the assistant cannot use: often a model without
      # structured output). It counts as one of the day's requests to that provider, and nothing of Peal's. Needs
      # assistant:configure.
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
      #   client.assistant.test_text_provider
      #
      # @return [untyped]
      def test_text_provider(request_options: {}, **_params)
        request = Peal::Internal::JSON::Request.new(
          base_url: request_options[:base_url],
          method: "POST",
          path: "api/v1/assistant/text-provider/test",
          request_options: request_options,
          max_retries: 0
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

      # Lists the AI providers the workspace connected with a key of its own: where each is reached, never its key. What
      # it uses each for is `GET .../assistant/models`'s to say. Needs assistant:configure, which no OAuth client holds
      # but Peal's command line.
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
      #   client.assistant.providers
      #
      # @return [Peal::Types::AiProviderConnections]
      def providers(request_options: {}, **_params)
        request = Peal::Internal::JSON::Request.new(
          base_url: request_options[:base_url],
          method: "GET",
          path: "api/v1/assistant/providers",
          request_options: request_options
        )
        begin
          response = @client.send(request)
        rescue Net::HTTPRequestTimeout
          raise Peal::Errors::TimeoutError
        end
        code = response.code.to_i
        if code.between?(200, 299)
          (response.body.to_s.empty? ? nil : Peal::Types::AiProviderConnections.load(response.body))
        else
          error_class = Peal::Errors::ResponseError.subclass_for_code(code)
          error_types = {
            401 => Peal::Types::UnauthenticatedEncoded
          }
          error_body = Peal::Errors::ResponseError.load_error_body(code, response.body, error_types)
          raise error_class.new(response.body, code: code, body: error_body, headers: response.to_hash)
        end
      end

      # Connects a provider of Peal's catalogue (`peal-contract/ai-providers`), or `openai-compatible`, any endpoint of
      # the OpenAI chat completions and images APIs, with the workspace's own key, or changes its address or key. It is
      # then offered for each use it serves (`PUT .../assistant/models/{capability}`), whose requests spend none of
      # Peal's allowance. Peal keeps the key encrypted for this workspace, this provider and this address, never shows
      # it again, and never sends it to another address: `apiKey` may be left out to keep the stored one only while
      # `baseUrl` stays exactly the same. The address must be public HTTPS; it is checked now, and before every call. A
      # provider reached at its own address alone (`fixedAddress`: ElevenLabs, fal, Shotstack) takes no other
      # (AiProviderAddressRefused `fixedAddress`): Shotstack takes its production API
      # (`https://api.shotstack.io/edit/v1`, the default) or its sandbox (`https://api.shotstack.io/edit/stage`, free
      # and watermarked), each with its own key. The provider is not called: test it with `POST
      # .../providers/{provider}/test`. Needs assistant:configure, which no OAuth client holds but Peal's command line.
      #
      # @param request_options [Hash]
      # @param params [Peal::Assistant::Types::AiProviderConnectionChange]
      # @option request_options [String] :base_url
      # @option request_options [Hash{String => Object}] :additional_headers
      # @option request_options [Hash{String => Object}] :additional_query_parameters
      # @option request_options [Hash{String => Object}] :additional_body_parameters
      # @option request_options [Integer] :timeout_in_seconds
      # @option params [Peal::Types::AiProvider] :provider
      #
      # @example
      #   client.assistant.connect_provider(provider: "anthropic")
      #
      # @return [Peal::Types::AiProviderConnection]
      def connect_provider(request_options: {}, **params)
        params = Peal::Internal::Types::Utils.normalize_keys(params)
        request_data = Peal::Assistant::Types::AiProviderConnectionChange.new(params).to_h
        non_body_param_names = %w[provider]
        body = request_data.except(*non_body_param_names)

        request = Peal::Internal::JSON::Request.new(
          base_url: request_options[:base_url],
          method: "PUT",
          path: "api/v1/assistant/providers/#{URI.encode_uri_component(params[:provider].to_s)}",
          body: body,
          request_options: request_options
        )
        begin
          response = @client.send(request)
        rescue Net::HTTPRequestTimeout
          raise Peal::Errors::TimeoutError
        end
        code = response.code.to_i
        if code.between?(200, 299)
          (response.body.to_s.empty? ? nil : Peal::Types::AiProviderConnection.load(response.body))
        else
          error_class = Peal::Errors::ResponseError.subclass_for_code(code)
          error_types = {
            401 => Peal::Types::UnauthenticatedEncoded
          }
          error_body = Peal::Errors::ResponseError.load_error_body(code, response.body, error_types)
          raise error_class.new(response.body, code: code, body: error_body, headers: response.to_hash)
        end
      end

      # Removes the provider and its key, and the uses it served: the server's model works for them again, if it has
      # one, within the workspace's allowance. Answers 204 whether or not the provider was connected. Needs
      # assistant:configure, which no OAuth client holds but Peal's command line.
      #
      # @param request_options [Hash]
      # @param params [Hash]
      # @option request_options [String] :base_url
      # @option request_options [Hash{String => Object}] :additional_headers
      # @option request_options [Hash{String => Object}] :additional_query_parameters
      # @option request_options [Hash{String => Object}] :additional_body_parameters
      # @option request_options [Integer] :timeout_in_seconds
      # @option params [Peal::Types::AiProvider] :provider
      #
      # @example
      #   client.assistant.disconnect_provider(provider: "anthropic")
      #
      # @return [untyped]
      def disconnect_provider(request_options: {}, **params)
        params = Peal::Internal::Types::Utils.normalize_keys(params)
        request = Peal::Internal::JSON::Request.new(
          base_url: request_options[:base_url],
          method: "DELETE",
          path: "api/v1/assistant/providers/#{URI.encode_uri_component(params[:provider].to_s)}",
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

      # Sends a connected provider one short request for text, a rewrite of a fixed sentence, as a member's request
      # would go, with `model` (left out, the model the workspace's text is written with when this provider writes it,
      # else the first Peal suggests for it), and answers 204 once the provider gave a suggestion the assistant can use.
      # Otherwise the answer says why, as a suggestion's would: TextProviderRefused (its settings, a redirect, its
      # address or its key) or AssistantFailed (unreachable, timed out, declined, or an answer the assistant cannot use:
      # often a model without structured output). It counts as one of the day's requests to the workspace's own
      # providers, and nothing of Peal's. Needs assistant:configure, which no OAuth client holds but Peal's command
      # line.
      #
      # @param request_options [Hash]
      # @param params [Peal::Assistant::Types::AiProviderTest]
      # @option request_options [String] :base_url
      # @option request_options [Hash{String => Object}] :additional_headers
      # @option request_options [Hash{String => Object}] :additional_query_parameters
      # @option request_options [Hash{String => Object}] :additional_body_parameters
      # @option request_options [Integer] :timeout_in_seconds
      # @option params [Peal::Types::AiProvider] :provider
      #
      # @example
      #   client.assistant.test_provider(provider: "anthropic")
      #
      # @return [untyped]
      def test_provider(request_options: {}, **params)
        params = Peal::Internal::Types::Utils.normalize_keys(params)
        request_data = Peal::Assistant::Types::AiProviderTest.new(params).to_h
        non_body_param_names = %w[provider]
        body = request_data.except(*non_body_param_names)

        request = Peal::Internal::JSON::Request.new(
          base_url: request_options[:base_url],
          method: "POST",
          path: "api/v1/assistant/providers/#{URI.encode_uri_component(params[:provider].to_s)}/test",
          body: body,
          request_options: request_options,
          max_retries: 0
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

      # Tells, for each use (text, images, videos, voice-overs, transcripts, slide videos), the connected provider and
      # the model the workspace chose, or none, and whether the server has a model of its own that works meanwhile.
      # Needs assistant:configure, which no OAuth client holds but Peal's command line.
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
      #   client.assistant.models
      #
      # @return [Peal::Types::AiCapabilityModels]
      def models(request_options: {}, **_params)
        request = Peal::Internal::JSON::Request.new(
          base_url: request_options[:base_url],
          method: "GET",
          path: "api/v1/assistant/models",
          request_options: request_options
        )
        begin
          response = @client.send(request)
        rescue Net::HTTPRequestTimeout
          raise Peal::Errors::TimeoutError
        end
        code = response.code.to_i
        if code.between?(200, 299)
          (response.body.to_s.empty? ? nil : Peal::Types::AiCapabilityModels.load(response.body))
        else
          error_class = Peal::Errors::ResponseError.subclass_for_code(code)
          error_types = {
            401 => Peal::Types::UnauthenticatedEncoded
          }
          error_body = Peal::Errors::ResponseError.load_error_body(code, response.body, error_types)
          raise error_class.new(response.body, code: code, body: error_body, headers: response.to_hash)
        end
      end

      # Chooses the provider and the model for one use: the provider must be connected (AiProviderNotConnected
      # otherwise) and offer the use (AiCapabilityNotOffered otherwise), and `model` is required (AiModelRequired) but
      # for `composition`, whose model is always `edit`. The workspace's drafts or prompts for that use then go to it,
      # with the workspace's key, and spend none of Peal's allowance, within a number of such requests a day. The model
      # is not checked: test the provider, or make a first request. Needs assistant:configure, which no OAuth client
      # holds but Peal's command line.
      #
      # @param request_options [Hash]
      # @param params [Peal::Assistant::Types::AiCapabilityModelChange]
      # @option request_options [String] :base_url
      # @option request_options [Hash{String => Object}] :additional_headers
      # @option request_options [Hash{String => Object}] :additional_query_parameters
      # @option request_options [Hash{String => Object}] :additional_body_parameters
      # @option request_options [Integer] :timeout_in_seconds
      # @option params [Peal::Types::AiCapability] :capability
      #
      # @example
      #   client.assistant.set_model(
      #     capability: "text",
      #     provider: "anthropic"
      #   )
      #
      # @return [Peal::Types::AiCapabilityModel]
      def set_model(request_options: {}, **params)
        params = Peal::Internal::Types::Utils.normalize_keys(params)
        request_data = Peal::Assistant::Types::AiCapabilityModelChange.new(params).to_h
        non_body_param_names = %w[capability]
        body = request_data.except(*non_body_param_names)

        request = Peal::Internal::JSON::Request.new(
          base_url: request_options[:base_url],
          method: "PUT",
          path: "api/v1/assistant/models/#{URI.encode_uri_component(params[:capability].to_s)}",
          body: body,
          request_options: request_options
        )
        begin
          response = @client.send(request)
        rescue Net::HTTPRequestTimeout
          raise Peal::Errors::TimeoutError
        end
        code = response.code.to_i
        if code.between?(200, 299)
          (response.body.to_s.empty? ? nil : Peal::Types::AiCapabilityModel.load(response.body))
        else
          error_class = Peal::Errors::ResponseError.subclass_for_code(code)
          error_types = {
            401 => Peal::Types::UnauthenticatedEncoded
          }
          error_body = Peal::Errors::ResponseError.load_error_body(code, response.body, error_types)
          raise error_class.new(response.body, code: code, body: error_body, headers: response.to_hash)
        end
      end

      # Leaves a use to the server's model, if it has one (`serverModel`), within the workspace's allowance, or off; the
      # provider stays connected. Needs assistant:configure, which no OAuth client holds but Peal's command line.
      #
      # @param request_options [Hash]
      # @param params [Hash]
      # @option request_options [String] :base_url
      # @option request_options [Hash{String => Object}] :additional_headers
      # @option request_options [Hash{String => Object}] :additional_query_parameters
      # @option request_options [Hash{String => Object}] :additional_body_parameters
      # @option request_options [Integer] :timeout_in_seconds
      # @option params [Peal::Types::AiCapability] :capability
      #
      # @example
      #   client.assistant.unset_model(capability: "text")
      #
      # @return [untyped]
      def unset_model(request_options: {}, **params)
        params = Peal::Internal::Types::Utils.normalize_keys(params)
        request = Peal::Internal::JSON::Request.new(
          base_url: request_options[:base_url],
          method: "DELETE",
          path: "api/v1/assistant/models/#{URI.encode_uri_component(params[:capability].to_s)}",
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
