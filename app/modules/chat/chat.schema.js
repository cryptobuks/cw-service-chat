module.exports = {
  getChats: {
    schema: {
      security: [
        {
          authorization: []
        }
      ],
      body: {
        type: 'object'
      }
    }
  },
  getChat: {
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
          }
        }
      }
    }
  },
  searchChats: {
    schema: {
      security: [
        {
          authorization: []
        }
      ],
      body: {
        type: 'object',
        required: ['query'],
        properties: {
          query: {
            type: 'string'
          }
        }
      }
    }
  },
  getFriend: {
    schema: {
      security: [
        {
          authorization: []
        }
      ],
      body: {
        type: 'object',
        required: ['profileId'],
        properties: {
          profileId: {
            type: 'string',
            typeof: 'ObjectId'
          }
        }
      }
    }
  },
  getFriends: {
    schema: {
      security: [
        {
          authorization: []
        }
      ],
      body: {
        type: 'object',
        required: ['profileIds'],
        properties: {
          profileIds: {
            type: 'array'
          }
        }
      }
    }
  },
  typing: {
    schema: {
      security: [
        {
          authorization: []
        }
      ],
      body: {
        type: 'object',
        required: ['chatId', 'profileId'],
        properties: {
          chatId: {
            type: 'string'
          },
          profileId: {
            type: 'string'
          }
        }
      }
    }
  }
}
