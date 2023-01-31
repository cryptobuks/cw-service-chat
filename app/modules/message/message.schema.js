const { reactions, clickTypes } = require('./message.constants')

module.exports = {
  createMessage: {
    schema: {
      security: [
        {
          authorization: []
        }
      ],
      body: {
        type: 'object',
        required: ['frontId', 'content'],
        properties: {
          frontId: {
            type: 'string'
          },
          chatId: {
            type: 'string'
          },
          toProfileId: {
            type: 'string',
            typeof: 'ObjectId'
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
          }
        }
      }
    }
  },
  createActionMessage: {
    schema: {
      security: [
        {
          authorization: []
        }
      ],
      body: {
        type: 'object',
        required: ['frontId', 'toProfileId', 'content'],
        properties: {
          frontId: {
            type: 'string'
          },
          toProfileId: {
            type: 'string',
            typeof: 'ObjectId'
          },
          content: {
            type: 'object',
            required: ['type', 'text', 'actions'],
            properties: {
              type: {
                type: 'string',
                enum: ['action']
              },
              text: {
                type: 'string'
              },
              actions: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['label', 'frontend', 'backend'],
                  properties: {
                    label: {
                      type: 'string'
                    },
                    tooltip: {
                      type: 'string'
                    },
                    showTo: {
                      type: 'array',
                      items: {
                        type: 'string'
                      }
                    },
                    active: {
                      type: 'boolean'
                    },
                    frontend: {
                      type: 'object'
                    },
                    backend: {
                      type: 'object'
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  },
  getMessages: {
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
          toMessageId: {
            type: 'string',
            typeof: 'ObjectId'
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
  hideInDashboard: {
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
            type: 'string'
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
  setMessageClick: {
    schema: {
      security: [
        {
          authorization: []
        }
      ],
      body: {
        type: 'object',
        required: ['messageId', 'type'],
        properties: {
          messageId: {
            type: 'string',
            typeof: 'ObjectId'
          },
          type: {
            type: 'string',
            enum: clickTypes
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
  },
  deleteMessage: {
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
  searchMessages: {
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
          chatId: {
            type: 'string'
          },
          limit: {
            type: 'number'
          },
          query: {
            type: 'string'
          }
        }
      }
    }
  },
  getReactionsList: {
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
  deleteMessageReaction: {
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
  },
  getAttachment: {
    schema: {
      security: [
        {
          authorization: []
        }
      ],
      body: {
        type: 'object',
        required: ['messageId', 'attachmentId'],
        properties: {
          messageId: {
            type: 'string'
          },
          attachmentId: {
            type: 'string'
          }
        }
      }
    }
  },
  initChat: {
    schema: {
      body: {
        type: 'object',
        anyOf: [{
          required: ['gymId', 'email'],
          properties: {
            gymId: {
              type: 'string',
              typeof: 'ObjectId'
            },
            email: {
              type: 'string',
              pattern: '[a-z0-9._%+!$&*=^|~#%{}/-]+@([a-z0-9-]+.){1,}([a-z]{2,22})'
            },
            dob: {
              type: 'string',
              maxLength: 8,
              minLength: 8
            }
          }
        }, {
          required: ['gymId', 'phone'],
          properties: {
            gymId: {
              type: 'string',
              typeof: 'ObjectId'
            },
            phone: {
              type: 'object',
              required: ['countryCode', 'prefixNumber', 'phoneNumber'],
              properties: {
                countryCode: {
                  type: 'string',
                  minLength: 1
                },
                prefixNumber: {
                  type: 'string',
                  minLength: 1
                },
                phoneNumber: {
                  type: 'string',
                  minLength: 1
                }
              }
            },
            dob: {
              type: 'string',
              maxLength: 8,
              minLength: 8
            }
          }
        }]
      }
    }
  },
  getMessagesForPlugin: {
    schema: {
      query: {
        type: 'object',
        required: ['sessionId'],
        properties: {
          sessionId: {
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
  sendMessageForPlugin: {
    schema: {
      body: {
        type: 'object',
        required: ['text', 'sessionId', 'frontId'],
        properties: {
          frontId: {
            type: 'string'
          },
          sessionId: {
            type: 'string'
          },
          text: {
            type: 'string'
          }
        }
      }
    }
  },
  checkSessionForPlugin: {
    schema: {
      query: {
        type: 'object',
        required: ['sessionId'],
        properties: {
          sessionId: {
            type: 'string'
          }
        }
      }
    }
  },
  tokenSchema: {
    schema: {
      body: {
        type: 'object',
        required: ['token', 'gymId'],
        properties: {
          token: { type: 'string', description: 'token string for verification' },
          gymId: { type: 'string', description: 'gymId for chat plugin' }
        }
      }
    }
  },
  gymDeviceBook: {
    schema: {
      body: {
        type: 'object',
        required: ['profileId', 'gymId', 'deviceId']
      }
    }
  },
  gymDeviceAsk: {
    schema: {
      body: {
        type: 'object',
        required: ['profileId', 'gymId', 'deviceId', 'text']
      }
    }
  },
  pluginSettings: {
    schema: {
      params: {
        type: 'object',
        required: ['gymId'],
        properties: {
          gymId: { type: 'string', description: 'gymId for chat plugin' }
        }
      }
    }
  },
  pluginLogout: {
    schema: {
      body: {
        type: 'object',
        required: ['sessionId'],
        properties: {
          sessionId: {
            type: 'string',
            description: 'sessionId for chat plugin'
          }
        }
      }
    }
  }
}
