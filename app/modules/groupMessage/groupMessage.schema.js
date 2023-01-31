const { reactions } = require('../message/message.constants')

module.exports = {
  getGroupMessages: {
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
  createGroupMessage: {
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
            type: 'object'
          },
          frontId: {
            type: 'string'
          }
        }
      }
    }
  },
  getOldestMessages: {
    schema: {
      security: [
        {
          authorization: []
        }
      ],
      body: {
        type: 'object',
        required: ['chatId', 'toMessageId'],
        properties: {
          chatId: {
            type: 'string'
          },
          toMessageId: {
            type: 'string',
            typeof: 'ObjectId'
          },
          limit: {
            type: 'number'
          }
        }
      }
    }
  },
  getLatestMessages: {
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
          fromMessageId: {
            type: 'string',
            typeof: 'ObjectId'
          },
          limit: {
            type: 'number'
          }
        }
      }
    }
  },
  getSearchedMessages: {
    schema: {
      security: [
        {
          authorization: []
        }
      ],
      body: {
        type: 'object',
        required: ['chatId', 'searchedMessageId'],
        properties: {
          chatId: {
            type: 'string'
          },
          searchedMessageId: {
            type: 'string',
            typeof: 'ObjectId'
          },
          limit: {
            type: 'number'
          }
        }
      }
    }
  },
  setMessageView: {
    schema: {
      security: [
        {
          authorization: []
        }
      ],
      body: {
        type: 'object',
        required: ['messageId'],
        properties: {
          messageId: {
            type: 'string',
            typeof: 'ObjectId'
          }
        }
      }
    }
  },
  setMessageReaction: {
    schema: {
      security: [
        {
          authorization: []
        }
      ],
      body: {
        type: 'object',
        required: ['messageId', 'reactionId'],
        properties: {
          messageId: {
            type: 'string',
            typeof: 'ObjectId'
          },
          reactionId: {
            type: 'string',
            enum: reactions.map(r => r.id)
          }
        }
      }
    }
  }
}
