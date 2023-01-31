const { db } = require('@cowellness/cw-micro-service')()
const constants = require('../broadcast.constants')

const Schema = db.chat.Schema

const membersSchema = new Schema(
  {
    profileId: {
      type: String
    },
    status: {
      type: String,
      enum: constants.memberStatus
    }
  },
  { timestamps: true }
)

module.exports = membersSchema
