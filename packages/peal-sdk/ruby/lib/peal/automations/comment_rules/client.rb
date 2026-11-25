# frozen_string_literal: true

module Peal
  module Automations
    module CommentRules
      class Client
        # @param client [Peal::Internal::Http::RawClient]
        #
        # @return [void]
        def initialize(client:)
          @client = client
        end

        # Lists the workspace's comment rules, oldest first, 50 a page unless `limit` (at most 100) says otherwise,
        # those with `status` alone when given, each with what its channels can carry and the latest 20 comments it
        # matched. A rule's `privateReply`, and each match's `privateCode`, `privateReplyId` and `privateStatus`, are
        # null to a reader who may not read private replies: one without engagement:readMessages, or an application the
        # owner did not let read the workspace's messages. Needs engagement:read.
        #
        # @param request_options [Hash]
        # @param params [Hash]
        # @option request_options [String] :base_url
        # @option request_options [Hash{String => Object}] :additional_headers
        # @option request_options [Hash{String => Object}] :additional_query_parameters
        # @option request_options [Hash{String => Object}] :additional_body_parameters
        # @option request_options [Integer] :timeout_in_seconds
        # @option params [String, nil] :cursor
        # @option params [String, nil] :limit
        # @option params [Peal::Types::CommentRuleStatus, nil] :status
        #
        # @example
        #   client.automations.comment_rules.list
        #
        # @return [Peal::Types::CommentRulePage]
        def list(request_options: {}, **params)
          params = Peal::Internal::Types::Utils.normalize_keys(params)
          query_params = {}
          query_params["cursor"] = params[:cursor] if params.key?(:cursor)
          query_params["limit"] = params[:limit] if params.key?(:limit)
          query_params["status"] = params[:status] if params.key?(:status)

          request = Peal::Internal::JSON::Request.new(
            base_url: request_options[:base_url],
            method: "GET",
            path: "api/v1/automations/comment-rules",
            query: query_params,
            request_options: request_options
          )
          begin
            response = @client.send(request)
          rescue Net::HTTPRequestTimeout
            raise Peal::Errors::TimeoutError
          end
          code = response.code.to_i
          if code.between?(200, 299)
            (response.body.to_s.empty? ? nil : Peal::Types::CommentRulePage.load(response.body))
          else
            error_class = Peal::Errors::ResponseError.subclass_for_code(code)
            error_types = {
              401 => Peal::Types::UnauthenticatedEncoded
            }
            error_body = Peal::Errors::ResponseError.load_error_body(code, response.body, error_types)
            raise error_class.new(response.body, code: code, body: error_body, headers: response.to_hash)
          end
        end

        # Starts a rule on the comments of a post that went out (`postId`) or of every post of a channel (`channelId`),
        # exactly one of them, with 1 to 10 `keywords`, a `reply` and, optionally, a `privateReply`. A rule answers, by
        # itself and in public, as the channel's account, a comment written after it started or was last set going
        # again, under a post it answers on (a post's rule acts on the channels the post is for, scheduled or out), that
        # holds one of its keywords as a word (whatever its case and accents): with its `reply`, once a comment and once
        # a person, 25 replies a day at most, and 100 a day for every rule of a channel together, through the inbox's
        # own replies (their journal, one reply a comment, each one of the billing account's outbound messages). It
        # answers on Mastodon, and on Facebook Pages and Instagram where the server reads their comments; Bluesky's,
        # X's, LinkedIn's and YouTube's rules forbid an app to answer by itself, and `channels` says so. It never likes
        # or follows anyone. With a `privateReply`, it also sends the author of each comment it answered that one
        # private message, once its public reply is out: only on Instagram and Facebook Pages, whose platforms let an
        # account send a commenter one message within 7 days of the comment, only where the channel's messages are on (a
        # channel that cannot carry it answers in public only, and the match's `privateCode` says why), never twice to a
        # comment, whoever sent the first, and never to anyone who did not comment. It acts as whoever started it, with
        # what they may do then: it ends when they can no longer answer comments, and when its channel is disconnected.
        # It is refused when no channel it answers on can carry its reply, or its private reply when it has one
        # (CommentRuleNotPossible, with each channel's reason). A workspace keeps 100 rules active or paused. Needs
        # engagement:reply, and engagement:message with a private reply (an application, the owner's consent for
        # messages too); never staff acting as a member.
        #
        # @param request_options [Hash]
        # @param params [Peal::Automations::CommentRules::Types::NewCommentRule]
        # @option request_options [String] :base_url
        # @option request_options [Hash{String => Object}] :additional_headers
        # @option request_options [Hash{String => Object}] :additional_query_parameters
        # @option request_options [Hash{String => Object}] :additional_body_parameters
        # @option request_options [Integer] :timeout_in_seconds
        #
        # @example
        #   client.automations.comment_rules.create(
        #     keywords: ["keywords"],
        #     reply: "reply"
        #   )
        #
        # @return [Peal::Types::CommentRule]
        def create(request_options: {}, **params)
          params = Peal::Internal::Types::Utils.normalize_keys(params)
          request = Peal::Internal::JSON::Request.new(
            base_url: request_options[:base_url],
            method: "POST",
            path: "api/v1/automations/comment-rules",
            body: Peal::Automations::CommentRules::Types::NewCommentRule.new(params).to_h,
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
            (response.body.to_s.empty? ? nil : Peal::Types::CommentRule.load(response.body))
          else
            error_class = Peal::Errors::ResponseError.subclass_for_code(code)
            error_types = {
              401 => Peal::Types::UnauthenticatedEncoded
            }
            error_body = Peal::Errors::ResponseError.load_error_body(code, response.body, error_types)
            raise error_class.new(response.body, code: code, body: error_body, headers: response.to_hash)
          end
        end

        # Says, for every platform in Peal's order, whether a comment rule can answer there on this server (`reply`) and
        # send its private reply (`privateReply`): where a rule may be started, before any channel's own standing. A
        # rule on a channel there is still refused when the channel must be connected again, or, for its private reply,
        # when the channel's messages are off or the channel is an Instagram account connected through Meta's unified
        # login, whose messages Peal does not read yet (its `privateReply` is `unsupported` there, though the platform's
        # is `available`); `channels` on the refusal and on the rule says so. Needs engagement:read.
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
        #   client.automations.comment_rules.platforms
        #
        # @return [Array[Peal::Types::PlatformCommentRule]]
        def platforms(request_options: {}, **_params)
          request = Peal::Internal::JSON::Request.new(
            base_url: request_options[:base_url],
            method: "GET",
            path: "api/v1/automations/comment-rules/platforms",
            request_options: request_options
          )
          begin
            response = @client.send(request)
          rescue Net::HTTPRequestTimeout
            raise Peal::Errors::TimeoutError
          end
          code = response.code.to_i
          if code.between?(200, 299)
            Peal::Internal::Types::Utils.coerce(Internal::Types::Array[Peal::Types::PlatformCommentRule], (response.body.to_s.empty? ? nil : JSON.parse(response.body, symbolize_names: true)))
          else
            error_class = Peal::Errors::ResponseError.subclass_for_code(code)
            error_types = {
              401 => Peal::Types::UnauthenticatedEncoded
            }
            error_body = Peal::Errors::ResponseError.load_error_body(code, response.body, error_types)
            raise error_class.new(response.body, code: code, body: error_body, headers: response.to_hash)
          end
        end

        # Answers a comment rule of the workspace, what its channels can carry and what it matched. A rule's
        # `privateReply`, and each match's `privateCode`, `privateReplyId` and `privateStatus`, are null to a reader who
        # may not read private replies: one without engagement:readMessages, or an application the owner did not let
        # read the workspace's messages. Needs engagement:read.
        #
        # @param request_options [Hash]
        # @param params [Hash]
        # @option request_options [String] :base_url
        # @option request_options [Hash{String => Object}] :additional_headers
        # @option request_options [Hash{String => Object}] :additional_query_parameters
        # @option request_options [Hash{String => Object}] :additional_body_parameters
        # @option request_options [Integer] :timeout_in_seconds
        # @option params [String] :rule_id
        #
        # @example
        #   client.automations.comment_rules.get(rule_id: "ruleId")
        #
        # @return [Peal::Types::CommentRule]
        def get(request_options: {}, **params)
          params = Peal::Internal::Types::Utils.normalize_keys(params)
          request = Peal::Internal::JSON::Request.new(
            base_url: request_options[:base_url],
            method: "GET",
            path: "api/v1/automations/comment-rules/#{URI.encode_uri_component(params[:rule_id].to_s)}",
            request_options: request_options
          )
          begin
            response = @client.send(request)
          rescue Net::HTTPRequestTimeout
            raise Peal::Errors::TimeoutError
          end
          code = response.code.to_i
          if code.between?(200, 299)
            (response.body.to_s.empty? ? nil : Peal::Types::CommentRule.load(response.body))
          else
            error_class = Peal::Errors::ResponseError.subclass_for_code(code)
            error_types = {
              401 => Peal::Types::UnauthenticatedEncoded
            }
            error_body = Peal::Errors::ResponseError.load_error_body(code, response.body, error_types)
            raise error_class.new(response.body, code: code, body: error_body, headers: response.to_hash)
          end
        end

        # Stops a rule: it answers nothing more; the replies it sent stay, and the inbox withdraws one as any other.
        # Needs engagement:reply.
        #
        # @param request_options [Hash]
        # @param params [Hash]
        # @option request_options [String] :base_url
        # @option request_options [Hash{String => Object}] :additional_headers
        # @option request_options [Hash{String => Object}] :additional_query_parameters
        # @option request_options [Hash{String => Object}] :additional_body_parameters
        # @option request_options [Integer] :timeout_in_seconds
        # @option params [String] :rule_id
        #
        # @example
        #   client.automations.comment_rules.delete(rule_id: "ruleId")
        #
        # @return [untyped]
        def delete(request_options: {}, **params)
          params = Peal::Internal::Types::Utils.normalize_keys(params)
          request = Peal::Internal::JSON::Request.new(
            base_url: request_options[:base_url],
            method: "DELETE",
            path: "api/v1/automations/comment-rules/#{URI.encode_uri_component(params[:rule_id].to_s)}",
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

        # Changes a rule's keywords, reply or private reply (`privateReply` null takes it off), or pauses it (`paused`
        # true) or sets it going again (false); what it leaves out stays. A paused rule looks at nothing, answers no
        # comment received while it was paused, and sends none of the private replies that waited for their public
        # reply. An ended rule changes no more (CommentRuleEnded). Needs engagement:reply, and engagement:message to
        # give a private reply, or to change the keywords or the reply of a rule that holds one or set it going again
        # (an application, the owner's consent for messages too); pausing a rule, or taking its private reply off, needs
        # engagement:reply alone.
        #
        # @param request_options [Hash]
        # @param params [Peal::Automations::CommentRules::Types::CommentRuleChange]
        # @option request_options [String] :base_url
        # @option request_options [Hash{String => Object}] :additional_headers
        # @option request_options [Hash{String => Object}] :additional_query_parameters
        # @option request_options [Hash{String => Object}] :additional_body_parameters
        # @option request_options [Integer] :timeout_in_seconds
        # @option params [String] :rule_id
        #
        # @example
        #   client.automations.comment_rules.update(rule_id: "ruleId")
        #
        # @return [Peal::Types::CommentRule]
        def update(request_options: {}, **params)
          params = Peal::Internal::Types::Utils.normalize_keys(params)
          request_data = Peal::Automations::CommentRules::Types::CommentRuleChange.new(params).to_h
          non_body_param_names = %w[ruleId]
          body = request_data.except(*non_body_param_names)

          request = Peal::Internal::JSON::Request.new(
            base_url: request_options[:base_url],
            method: "PATCH",
            path: "api/v1/automations/comment-rules/#{URI.encode_uri_component(params[:rule_id].to_s)}",
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
            (response.body.to_s.empty? ? nil : Peal::Types::CommentRule.load(response.body))
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
