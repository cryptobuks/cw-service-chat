const constants = require('./group.constants')

module.exports = {
  getGroups: {
    schema: {
      summary: 'Get a list of groups',
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
  createGroup: {
    schema: {
      summary: 'Create a group',
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
  getGroup: {
    schema: {
      summary: 'Get a single group',
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
  updateGroup: {
    schema: {
      summary: 'Update a group',
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
  deleteGroup: {
    schema: {
      summary: 'Delete a group',
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
  changeMemberStatus: {
    schema: {
      summary: 'Change member status (active, suspended ...)',
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
