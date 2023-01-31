const { db, ctr } = require('@cowellness/cw-micro-service')()
const { channels, messageType, reactions, clickTypes } = require('./message.constants')
const actionSchema = require('./subschema/actions.subschema')

const Schema = db.chat.Schema

const messageSchema = new Schema(
  {
    frontId: {
      type: String,
      index: true
    },
    chatId: {
      type: String,
      index: true
    },
    channel: {
      type: String,
      enum: channels
    },
    sessionId: {
      type: String
    },
    deviceId: {
      type: String
    },
    fromProfileId: {
      type: String,
      index: true
    },
    fromManagerProfileId: {
      type: String
    },
    broadcastMessageId: {
      type: String
    },
    toProfileId: {
      type: String,
      index: true
    },
    replyToMessageId: {
      type: Schema.Types.ObjectId,
      ref: 'Message'
    },
    showInDashboard: {
      type: Boolean
    },
    content: {
      type: {
        type: String,
        enum: messageType
      },
      text: {
        type: String
      },
      contentData: {
        type: {
          type: String,
          enum: ['substitute', 'askToChange']
        },
        data: Object
      },
      imageId: {
        type: String
      },
      filename: {
        type: String
      },
      mimeType: {
        type: String
      },
      audioId: {
        type: String
      },
      fileId: {
        type: String
      },
      size: {
        type: String
      },
      html: {
        type: String
      },
      subject: {
        type: String
      },
      to: {
        type: [String],
        default: undefined
      },
      from: {
        type: String
      },
      cc: {
        type: [String],
        default: undefined
      },
      attachments: {
        type: [Object],
        default: undefined
      },
      messageId: {
        type: String
      },
      actions: {
        type: [actionSchema]
      }
    },
    clicks: {
      type: [{
        profileId: String,
        type: {
          type: String,
          enum: clickTypes
        },
        value: {
          type: String
        },
        time: {
          type: Date,
          default: Date.now
        }
      }]
    },
    actions: {
      type: [{
        profileId: String,
        action: {
          type: Object
        },
        time: {
          type: Date,
          default: Date.now
        }
      }]
    },
    reactions: {
      type: [{
        profileId: String,
        reactionId: {
          type: String,
          enum: reactions.map(e => e.id)
        },
        time: {
          type: Date,
          default: Date.now
        }
      }]
    },
    isViewed: {
      type: Boolean,
      index: true,
      default: false
    },
    viewedAt: {
      type: Date,
      default: null
    },
    isForwarded: {
      type: Boolean,
      default: false
    },
    isDeleted: {
      type: Boolean,
      default: false
    },
    deletedAt: {
      type: Date,
      default: null
    },
    isManaged: {
      type: Boolean,
      default: false
    },
    managedAt: {
      type: Date,
      default: null
    },
    isDelivered: {
      type: Boolean,
      default: false
    },
    deliveredAt: {
      type: Date,
      default: null
    },
    createdAt: {
      type: Date
    }
  },
  { timestamps: true }
)
messageSchema.index({ createdAt: 1 })
messageSchema.virtual('_replyToMessage', {
  localField: 'replyToMessageId',
  foreignField: '_id',
  ref: 'Message',
  justOne: true
}, { toJSON: { virtuals: true } })

messageSchema.post('save', doc => {
  ctr.message.updateEsIndex(doc)
})
messageSchema.post('findOneAndUpdate', doc => {
  ctr.message.updateEsIndex(doc)
})
const Message = db.chat.model('Message', messageSchema)

// Message.synchronize({}, { saveOnSynchronize: true })

module.exports = Message
