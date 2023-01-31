const { db, ctr } = require('@cowellness/cw-micro-service')()

const { messageType, reactions, clickTypes } = require('../message/message.constants')

const Schema = db.chat.Schema

const newSchema = new Schema(
  {
    frontId: {
      type: String,
      index: true
    },
    fromProfileId: {
      type: String,
      index: true
    },
    fromManagerProfileId: {
      type: String
    },
    broadcastId: {
      type: String
    },
    chatId: {
      type: String
    },
    toProfileIds: [String],
    content: {
      type: {
        type: String,
        enum: messageType
      },
      text: {
        type: String
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
      }
    },
    views: {
      type: [{
        profileId: String,
        time: {
          type: Date,
          default: Date.now
        }
      }]
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
    isDeleted: {
      type: Boolean,
      default: false
    },
    deletedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
)

newSchema.post('save', doc => ctr.broadcastMessage.updateEsIndex(doc))
newSchema.post('findOneAndUpdate', doc => ctr.broadcastMessage.updateEsIndex(doc))
module.exports = db.chat.model('Broadcastmessage', newSchema)
