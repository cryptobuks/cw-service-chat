module.exports = {
  getBroadcastMessages: {
    schema: {
      security: [
        {
          authorization: []
        }
      ],
      body: {
        type: 'object',
        required: ['chatId'],
        properties: {
          chatId: {
            type: 'string'
          },
          offset: {
            type: 'number'
          },
          limit: {
            type: 'number'
          }
        }
      }
    }
  },
  createBroadcastMessage: {
    schema: {
      security: [
        {
          authorization: []
        }
      ],
      body: {
        type: 'object',
        required: ['chatId', 'content', 'frontId'],
        properties: {
          chatId: {
            type: 'string'
          },
          content: {
            type: 'object',
            anyOf: [{
              required: ['type', 'text'],
              properties: {
                type: {
                  type: 'string',
                  enum: ['text', 'action', 'email']
                },
                text: {
                  type: 'string'
                }
              }
            },
            {
              required: ['type', 'base64'],
              properties: {
                type: {
                  type: 'string',
                  enum: ['image', 'audio', 'file']
                },
                base64: {
                  type: 'string',
                  typeof: 'Base64'
                },
                filename: {
                  type: 'string'
                }
              }
            },
            {
              required: ['type', 'imageId'],
              properties: {
                type: {
                  type: 'string',
                  enum: ['image']
                },
                imageId: {
                  type: 'string'
                },
                filename: {
                  type: 'string'
                }
              }
            },
            {
              required: ['type', 'audioId'],
              properties: {
                type: {
                  type: 'string',
                  enum: ['audio']
                },
                audioId: {
                  type: 'string'
                },
                filename: {
                  type: 'string'
                }
              }
            },
            {
              required: ['type', 'fileId'],
              properties: {
                type: {
                  type: 'string',
                  enum: ['file']
                },
                fileId: {
                  type: 'string'
                },
                filename: {
                  type: 'string'
                }
              }
            }]
          },
          frontId: {
            type: 'string'
          }
        }
      }
    }
  }
}
