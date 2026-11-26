using NUnit.Framework;
using Peal;
using Peal.Test.Unit.MockServer;
using Peal.Test.Utils;

namespace Peal.Test.Unit.MockServer.Posts;

[TestFixture]
[Parallelizable(ParallelScope.Self)]
public class SetTagsTest : BaseMockServerTest
{
    [NUnit.Framework.Test]
    public async Task MockServerTest_1()
    {
        const string requestJson = """
            {
              "tagIds": [
                "tagIds",
                "tagIds"
              ]
            }
            """;

        const string mockResponse = """
            {
              "authorId": "authorId",
              "content": {
                "followUps": [
                  {
                    "delaySeconds": 86400,
                    "media": [
                      {
                        "altText": "altText",
                        "mediaId": "mediaId"
                      },
                      {
                        "altText": "altText",
                        "mediaId": "mediaId"
                      }
                    ],
                    "overrides": [
                      {
                        "body": {
                          "content": [
                            {
                              "key": "value"
                            },
                            {
                              "key": "value"
                            }
                          ],
                          "type": "doc"
                        },
                        "channelId": "channelId",
                        "media": [
                          {
                            "altText": "altText",
                            "mediaId": "mediaId"
                          },
                          {
                            "altText": "altText",
                            "mediaId": "mediaId"
                          }
                        ],
                        "text": "text"
                      },
                      {
                        "body": {
                          "content": [
                            {
                              "key": "value"
                            },
                            {
                              "key": "value"
                            }
                          ],
                          "type": "doc"
                        },
                        "channelId": "channelId",
                        "media": [
                          {
                            "altText": "altText",
                            "mediaId": "mediaId"
                          },
                          {
                            "altText": "altText",
                            "mediaId": "mediaId"
                          }
                        ],
                        "text": "text"
                      }
                    ],
                    "text": "text"
                  },
                  {
                    "delaySeconds": 86400,
                    "media": [
                      {
                        "altText": "altText",
                        "mediaId": "mediaId"
                      },
                      {
                        "altText": "altText",
                        "mediaId": "mediaId"
                      }
                    ],
                    "overrides": [
                      {
                        "body": {
                          "content": [
                            {
                              "key": "value"
                            },
                            {
                              "key": "value"
                            }
                          ],
                          "type": "doc"
                        },
                        "channelId": "channelId",
                        "media": [
                          {
                            "altText": "altText",
                            "mediaId": "mediaId"
                          },
                          {
                            "altText": "altText",
                            "mediaId": "mediaId"
                          }
                        ],
                        "text": "text"
                      },
                      {
                        "body": {
                          "content": [
                            {
                              "key": "value"
                            },
                            {
                              "key": "value"
                            }
                          ],
                          "type": "doc"
                        },
                        "channelId": "channelId",
                        "media": [
                          {
                            "altText": "altText",
                            "mediaId": "mediaId"
                          },
                          {
                            "altText": "altText",
                            "mediaId": "mediaId"
                          }
                        ],
                        "text": "text"
                      }
                    ],
                    "text": "text"
                  }
                ],
                "media": [
                  {
                    "altText": "altText",
                    "mediaId": "mediaId"
                  },
                  {
                    "altText": "altText",
                    "mediaId": "mediaId"
                  }
                ],
                "overrides": [
                  {
                    "body": {
                      "content": [
                        {
                          "key": "value"
                        },
                        {
                          "key": "value"
                        }
                      ],
                      "type": "doc"
                    },
                    "channelId": "channelId",
                    "media": [
                      {
                        "altText": "altText",
                        "mediaId": "mediaId"
                      },
                      {
                        "altText": "altText",
                        "mediaId": "mediaId"
                      }
                    ],
                    "text": "text"
                  },
                  {
                    "body": {
                      "content": [
                        {
                          "key": "value"
                        },
                        {
                          "key": "value"
                        }
                      ],
                      "type": "doc"
                    },
                    "channelId": "channelId",
                    "media": [
                      {
                        "altText": "altText",
                        "mediaId": "mediaId"
                      },
                      {
                        "altText": "altText",
                        "mediaId": "mediaId"
                      }
                    ],
                    "text": "text"
                  }
                ],
                "poll": {
                  "choices": [
                    "choices",
                    "choices"
                  ],
                  "durationMinutes": 43829,
                  "multipleChoice": true
                },
                "text": "text"
              },
              "createdAt": "createdAt",
              "createdVia": {
                "id": "id",
                "name": "name",
                "via": "web"
              },
              "externalId": "externalId",
              "id": "id",
              "occurrence": 1,
              "outcome": "published",
              "queueId": "queueId",
              "recyclingId": "recyclingId",
              "schedule": {
                "at": "at",
                "timeZone": "timeZone"
              },
              "scheduledBy": "scheduledBy",
              "scheduledVia": {
                "id": "id",
                "name": "name",
                "via": "web"
              },
              "shortenLinks": true,
              "status": "draft",
              "tagIds": [
                "tagIds",
                "tagIds"
              ],
              "targets": [
                {
                  "channelId": "channelId",
                  "dropped": true,
                  "editedAt": "editedAt",
                  "failureReason": "contentRejected",
                  "id": "id",
                  "keptPrivate": true,
                  "options": {
                    "platform": "youtube",
                    "categoryId": "categoryId",
                    "containsSyntheticMedia": true,
                    "defaultLanguage": "defaultLanguage",
                    "embeddable": true,
                    "license": "youtube",
                    "madeForKids": true,
                    "notifySubscribers": true,
                    "privacy": "public",
                    "publicStatsViewable": true,
                    "recordingDate": "recordingDate",
                    "tags": [
                      "tags",
                      "tags"
                    ],
                    "thumbnailMediaId": "thumbnailMediaId",
                    "title": "title"
                  },
                  "parts": {
                    "count": 1,
                    "live": [
                      {
                        "index": 1,
                        "permalink": "permalink",
                        "platformPostId": "platformPostId",
                        "publishedAt": "publishedAt"
                      },
                      {
                        "index": 1,
                        "permalink": "permalink",
                        "platformPostId": "platformPostId",
                        "publishedAt": "publishedAt"
                      }
                    ]
                  },
                  "permalink": "permalink",
                  "publishedAt": "publishedAt",
                  "removedAt": "removedAt",
                  "partsLeftOut": true,
                  "round": 1,
                  "status": "pending",
                  "thumbnailNotSet": true,
                  "unconfirmedReason": "noResponse"
                },
                {
                  "channelId": "channelId",
                  "dropped": true,
                  "editedAt": "editedAt",
                  "failureReason": "contentRejected",
                  "id": "id",
                  "keptPrivate": true,
                  "options": {
                    "platform": "youtube",
                    "categoryId": "categoryId",
                    "containsSyntheticMedia": true,
                    "defaultLanguage": "defaultLanguage",
                    "embeddable": true,
                    "license": "youtube",
                    "madeForKids": true,
                    "notifySubscribers": true,
                    "privacy": "public",
                    "publicStatsViewable": true,
                    "recordingDate": "recordingDate",
                    "tags": [
                      "tags",
                      "tags"
                    ],
                    "thumbnailMediaId": "thumbnailMediaId",
                    "title": "title"
                  },
                  "parts": {
                    "count": 1,
                    "live": [
                      {
                        "index": 1,
                        "permalink": "permalink",
                        "platformPostId": "platformPostId",
                        "publishedAt": "publishedAt"
                      },
                      {
                        "index": 1,
                        "permalink": "permalink",
                        "platformPostId": "platformPostId",
                        "publishedAt": "publishedAt"
                      }
                    ]
                  },
                  "permalink": "permalink",
                  "publishedAt": "publishedAt",
                  "removedAt": "removedAt",
                  "partsLeftOut": true,
                  "round": 1,
                  "status": "pending",
                  "thumbnailNotSet": true,
                  "unconfirmedReason": "noResponse"
                }
              ],
              "updatedAt": "updatedAt",
              "warnings": [
                {
                  "_tag": "channelsDropped",
                  "channelIds": [
                    "channelIds",
                    "channelIds"
                  ],
                  "channelSetId": "channelSetId",
                  "channelSetName": "channelSetName"
                },
                {
                  "_tag": "channelsDropped",
                  "channelIds": [
                    "channelIds",
                    "channelIds"
                  ],
                  "channelSetId": "channelSetId",
                  "channelSetName": "channelSetName"
                }
              ]
            }
            """;

        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/v1/posts/postId/tags")
                    .WithHeader("Content-Type", "application/json")
                    .UsingPut()
                    .WithBodyAsJson(requestJson)
            )
            .RespondWith(
                WireMock
                    .ResponseBuilders.Response.Create()
                    .WithStatusCode(200)
                    .WithBody(mockResponse)
            );

        var response = await Client.Posts.SetTagsAsync(
            new PostTags
            {
                PostId = "postId",
                TagIds = new List<string>() { "tagIds", "tagIds" },
            }
        );
        JsonAssert.AreEqual(response, mockResponse);
    }

    [NUnit.Framework.Test]
    public async Task MockServerTest_2()
    {
        const string requestJson = """
            {
              "tagIds": [
                "tagIds"
              ]
            }
            """;

        const string mockResponse = """
            {
              "authorId": "authorId",
              "content": {
                "followUps": [
                  {
                    "delaySeconds": 1,
                    "media": [
                      {
                        "altText": "altText",
                        "mediaId": "mediaId"
                      }
                    ],
                    "overrides": [
                      {
                        "channelId": "channelId",
                        "text": "text"
                      }
                    ],
                    "text": "text"
                  }
                ],
                "media": [
                  {
                    "altText": "altText",
                    "mediaId": "mediaId"
                  }
                ],
                "overrides": [
                  {
                    "channelId": "channelId",
                    "text": "text"
                  }
                ],
                "poll": {
                  "choices": [
                    "choices"
                  ],
                  "durationMinutes": 1,
                  "multipleChoice": true
                },
                "text": "text"
              },
              "createdAt": "createdAt",
              "createdVia": {
                "id": "id",
                "name": "name",
                "via": "web"
              },
              "externalId": "externalId",
              "id": "id",
              "occurrence": 1,
              "outcome": "published",
              "queueId": "queueId",
              "recyclingId": "recyclingId",
              "schedule": {
                "at": "at",
                "timeZone": "timeZone"
              },
              "scheduledBy": "scheduledBy",
              "scheduledVia": {
                "id": "id",
                "name": "name",
                "via": "web"
              },
              "shortenLinks": true,
              "status": "draft",
              "tagIds": [
                "tagIds"
              ],
              "targets": [
                {
                  "channelId": "channelId",
                  "dropped": true,
                  "editedAt": "editedAt",
                  "failureReason": "contentRejected",
                  "id": "id",
                  "keptPrivate": true,
                  "options": {
                    "platform": "youtube"
                  },
                  "parts": {
                    "count": 1,
                    "live": [
                      {
                        "index": 1,
                        "publishedAt": "publishedAt"
                      }
                    ]
                  },
                  "permalink": "permalink",
                  "publishedAt": "publishedAt",
                  "removedAt": "removedAt",
                  "partsLeftOut": true,
                  "round": 1,
                  "status": "pending",
                  "thumbnailNotSet": true,
                  "unconfirmedReason": "noResponse"
                }
              ],
              "updatedAt": "updatedAt",
              "warnings": [
                {
                  "_tag": "channelsDropped",
                  "channelIds": [
                    "channelIds"
                  ],
                  "channelSetId": "channelSetId",
                  "channelSetName": "channelSetName"
                }
              ]
            }
            """;

        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/v1/posts/postId/tags")
                    .WithHeader("Content-Type", "application/json")
                    .UsingPut()
                    .WithBodyAsJson(requestJson)
            )
            .RespondWith(
                WireMock
                    .ResponseBuilders.Response.Create()
                    .WithStatusCode(200)
                    .WithBody(mockResponse)
            );

        var response = await Client.Posts.SetTagsAsync(
            new PostTags
            {
                PostId = "postId",
                TagIds = new List<string>() { "tagIds" },
            }
        );
        JsonAssert.AreEqual(response, mockResponse);
    }
}
