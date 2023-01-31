const { db, ctr } = require('@cowellness/cw-micro-service')()
const { messageType, reactions } = require('../message/message.constants')
const { channels } = require('./groupMessage.constants')

const Schema = db.chat.Schema

const newSchema = new Schema(
  {
    frontId: {
      type: String
    },
    chatId: {
      type: String,
      index: true
    },
    channel: {
      type: String,
      enum: channels
    },
    fromProfileId: {
      type: String
    },
    fromManagerProfileId: {
      type: String
    },
    groupId: {
      type: String
    },
    toProfileIds: {
      type: [String]
    },
    replyToMessageId: {
      type: Schema.Types.ObjectId,
      ref: 'GroupMessage'
    },
    content: {
      type: {
        type: String,
        enum: messageType
      },
      text: {
        type: String
      },
      imageId: String,
      imageUrl: String
    },
    views: [{
      profileId: String,
      time: {
        type: Date,
        default: Date.now
      }
    }],
    clicks: [{
      profileId: String,
      link: String,
      time: {
        type: Date,
        default: Date.now
      }
    }],
    reactions: [{
      profileId: String,
      reactionId: {
        type: String,
        enum: reactions.map(e => e.id)
      },
      time: {
        type: Date,
        default: Date.now
      }
    }],
    isViewed: {
      type: Boolean,
      default: false
    },
    viewedAt: {
      type: Date
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
    createdAt: {
      type: Date
    }
  },
  { timestamps: true }
)
newSchema.index({ createdAt: 1 })
newSchema.virtual('_replyToMessage', {
  localField: 'replyToMessageId',
  foreignField: '_id',
  ref: 'GroupMessage',
  justOne: true
}, { toJSON: { virtuals: true } })
newSchema.post('save', doc => ctr.groupMessage.updateEsIndex(doc))
newSchema.post('findOneAndUpdate', doc => ctr.groupMessage.updateEsIndex(doc))
module.exports = db.chat.model('GroupMessage', newSchema)
