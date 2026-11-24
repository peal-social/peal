# frozen_string_literal: true

module Peal
  module Media
    module Voiceovers
      class Client
        # @param client [Peal::Internal::Http::RawClient]
        #
        # @return [void]
        def initialize(client:)
          @client = client
        end

        # Asks the provider the workspace chose for voice-overs (`PUT .../assistant/models/speech`) to speak the text,
        # in `voice` when given, and answers with the audio as a new file of the media library, marked `aiGenerated`,
        # without a description. Only the workspace's own provider speaks, with its key, under its terms and at its
        # prices: Peal bills nothing for it. 50 a UTC day (AudioAllowanceReached), whatever each ends with. The plan's
        # media storage must have room for the largest voice-over before anything is asked. Neither the text nor the
        # audio is logged. Needs assistant:use and media:upload.
        #
        # @param request_options [Hash]
        # @param params [Peal::Media::Voiceovers::Types::VoiceoverRequest]
        # @option request_options [String] :base_url
        # @option request_options [Hash{String => Object}] :additional_headers
        # @option request_options [Hash{String => Object}] :additional_query_parameters
        # @option request_options [Hash{String => Object}] :additional_body_parameters
        # @option request_options [Integer] :timeout_in_seconds
        #
        # @example
        #   client.media.voiceovers.create(text: "text")
        #
        # @return [Peal::Types::Media]
        def create(request_options: {}, **params)
          params = Peal::Internal::Types::Utils.normalize_keys(params)
          request = Peal::Internal::JSON::Request.new(
            base_url: request_options[:base_url],
            method: "POST",
            path: "api/v1/media/voiceovers",
            body: Peal::Media::Voiceovers::Types::VoiceoverRequest.new(params).to_h,
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
            (response.body.to_s.empty? ? nil : Peal::Types::Media.load(response.body))
          else
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
end
