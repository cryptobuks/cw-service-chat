const constants = require('./broadcast.constants')

module.exports = {
  getBroadcasts: {
    schema: {
      summary: 'Get a list of broadcasts',
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
  createBroadcast: {
    schema: {
      summary: 'Create a broadcast',
      security: [
        {
          authorization: []
        }
      ],
      body: {
        type: 'object',
        required: ['name', 'filter'],
        properties: {
          name: {
            type: 'string'
          },
          description: {
            type: 'string'
          },
          filter: {
            type: 'object'
          },
          base64: {
            type: 'string',
            typeof: 'Base64'
          }
        }
      }
    }
  },
  getBroadcast: {
    schema: {
      summary: 'Get a single broadcast',
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
  updateBroadcast: {
    schema: {
      summary: 'Update a broadcast',
      security: [
        {
          authorization: []
        }
      ],
      body: {
        type: 'object',
        required: ['chatId', 'name', 'filter'],
        properties: {
          chatId: {
            type: 'string'
          },
          name: {
            type: 'string'
          },
          description: {
            type: 'string'
          },
          filter: {
            type: 'object'
          },
          base64: {
            type: 'string',
            typeof: 'Base64'
          }
        }
      }
    }
  },
  deleteBroadcast: {
    schema: {
      summary: 'Delete a broadcast',
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
  filterTarget: {
    schema: {
      summary: 'Get filter suggestions',
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
  changeMemberStatus: {
    schema: {
      summary: 'Change member status (active, suspended)',
      security: [
        {
          authorization: []
        }
      ],
      body: {
        type: 'object',
        required: ['chatId', 'profileId', 'status'],
        properties: {
          chatId: {
            type: 'string'
          },
          profileId: {
            type: 'string'
          },
          status: {
            type: 'string',
            enum: constants.memberStatus
          }
        }
      }
    }
  }
}
