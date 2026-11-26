using NUnit.Framework;
using Peal.Automations;
using Peal.Test.Unit.MockServer;
using Peal.Test.Utils;

namespace Peal.Test.Unit.MockServer.Automations.Recycling;

[TestFixture]
[Parallelizable(ParallelScope.Self)]
public class ListTest : BaseMockServerTest
{
    [NUnit.Framework.Test]
    public async Task MockServerTest_1()
    {
        const string mockResponse = """
            {
              "items": [
                {
                  "anchorAt": "anchorAt",
                  "coming": [
                    {
                      "at": "at",
                      "occurrence": 1,
                      "variant": 1
                    },
                    {
                      "at": "at",
                      "occurrence": 1,
                      "variant": 1
                    }
                  ],
                  "count": 1,
                  "createdAt": "createdAt",
                  "endedReason": "completed",
                  "every": {
                    "count": 1,
                    "unit": "days"
                  },
                  "id": "id",
                  "lastDueAt": "lastDueAt",
                  "made": 1,
                  "nextDueAt": "nextDueAt",
                  "queueId": "queueId",
                  "sourcePostId": "sourcePostId",
                  "startedBy": "startedBy",
                  "startedVia": {
                    "id": "id",
                    "name": "name",
                    "via": "web"
                  },
                  "status": "active",
                  "timeZone": "timeZone",
                  "until": "until",
                  "variants": [
                    {
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
                  ]
                },
                {
                  "anchorAt": "anchorAt",
                  "coming": [
                    {
                      "at": "at",
                      "occurrence": 1,
                      "variant": 1
                    },
                    {
                      "at": "at",
                      "occurrence": 1,
                      "variant": 1
                    }
                  ],
                  "count": 1,
                  "createdAt": "createdAt",
                  "endedReason": "completed",
                  "every": {
                    "count": 1,
                    "unit": "days"
                  },
                  "id": "id",
                  "lastDueAt": "lastDueAt",
                  "made": 1,
                  "nextDueAt": "nextDueAt",
                  "queueId": "queueId",
                  "sourcePostId": "sourcePostId",
                  "startedBy": "startedBy",
                  "startedVia": {
                    "id": "id",
                    "name": "name",
                    "via": "web"
                  },
                  "status": "active",
                  "timeZone": "timeZone",
                  "until": "until",
                  "variants": [
                    {
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
                  ]
                }
              ],
              "nextCursor": "nextCursor"
            }
            """;

        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/v1/automations/recycling")
                    .UsingGet()
            )
            .RespondWith(
                WireMock
                    .ResponseBuilders.Response.Create()
                    .WithStatusCode(200)
                    .WithBody(mockResponse)
            );

        var response = await Client.Automations.Recycling.ListAsync(new ListRecyclingRequest());
        JsonAssert.AreEqual(response, mockResponse);
    }

    [NUnit.Framework.Test]
    public async Task MockServerTest_2()
    {
        const string mockResponse = """
            {
              "items": [
                {
                  "anchorAt": "anchorAt",
                  "coming": [
                    {
                      "at": "at",
                      "occurrence": 1
                    }
                  ],
                  "count": 1,
                  "createdAt": "createdAt",
                  "endedReason": "completed",
                  "every": {
                    "count": 1,
                    "unit": "days"
                  },
                  "id": "id",
                  "lastDueAt": "lastDueAt",
                  "made": 1,
                  "nextDueAt": "nextDueAt",
                  "queueId": "queueId",
                  "sourcePostId": "sourcePostId",
                  "startedBy": "startedBy",
                  "startedVia": {
                    "via": "web"
                  },
                  "status": "active",
                  "timeZone": "timeZone",
                  "until": "until",
                  "variants": [
                    {
                      "overrides": [
                        {
                          "channelId": "channelId",
                          "text": "text"
                        }
                      ],
                      "text": "text"
                    }
                  ]
                }
              ],
              "nextCursor": "nextCursor"
            }
            """;

        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/v1/automations/recycling")
                    .UsingGet()
            )
            .RespondWith(
                WireMock
                    .ResponseBuilders.Response.Create()
                    .WithStatusCode(200)
                    .WithBody(mockResponse)
            );

        var response = await Client.Automations.Recycling.ListAsync(new ListRecyclingRequest());
        JsonAssert.AreEqual(response, mockResponse);
    }
}
