# frozen_string_literal: true

module Peal
  module Media
    module Transcriptions
      class Client
        # @param client [Peal::Internal::Http::RawClient]
        #
        # @return [void]
        def initialize(client:)
          @client = client
        end

        # Sends a ready audio or video file of the media library, of at most 25000000 bytes, to the provider the
        # workspace chose for transcripts (`PUT .../assistant/models/transcription`), and answers with what is said in
        # it. With `saveAsDescription`, the transcript becomes the file's description when it fits one
        # (`descriptionSaved`). Only the workspace's own provider transcribes, with its key, under its terms and at its
        # prices: Peal bills nothing for it. 50 a UTC day (AudioAllowanceReached), whatever each ends with. Neither the
        # file nor the transcript is logged, and the transcript is kept only as the description asked for. Needs
        # assistant:use and media:read, and media:upload to save the description.
        #
        # @param request_options [Hash]
        # @param params [Peal::Media::Transcriptions::Types::TranscriptionRequest]
        # @option request_options [String] :base_url
        # @option request_options [Hash{String => Object}] :additional_headers
        # @option request_options [Hash{String => Object}] :additional_query_parameters
        # @option request_options [Hash{String => Object}] :additional_body_parameters
        # @option request_options [Integer] :timeout_in_seconds
        # @option params [String] :media_id
        #
        # @example
        #   client.media.transcriptions.create(media_id: "mediaId")
        #
        # @return [Peal::Types::Transcript]
        def create(request_options: {}, **params)
          params = Peal::Internal::Types::Utils.normalize_keys(params)
          request_data = Peal::Media::Transcriptions::Types::TranscriptionRequest.new(params).to_h
          non_body_param_names = %w[mediaId]
          body = request_data.except(*non_body_param_names)

          request = Peal::Internal::JSON::Request.new(
            base_url: request_options[:base_url],
            method: "POST",
            path: "api/v1/media/#{URI.encode_uri_component(params[:media_id].to_s)}/transcriptions",
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
          if code.between?(200, 299)
            (response.body.to_s.empty? ? nil : Peal::Types::Transcript.load(response.body))
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
