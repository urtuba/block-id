const IdentityVerification = require('../models/identity-verification')
const BlockIdGrantCode = require( '../models/block-id-grant-code' )
const User = require( '../models/user' )

module.exports = async (req, res) => {
  const { code, walletAddress } = req.headers
  if (!code) {
    return res.status(400).send('Missing Code')
  }

  try {
    const user = await User.findOne({ walletAddress })
    if (!user) {
      return res.status(404).send('User Not Found')
    }

    const code = await BlockIdGrantCode.findOne({ user: user._id, code })
    if (!code) {
      return res.status(404).send('Grant Code Not Found')
    }

    const id = await IdentityVerification.findOne({ user: user._id })

    res.status(200).send({
      firstName: id.firstName,
      lastName: id.lastName,
      birthDate: id.birthDate,
      identityNumber: id.identityNumber,
      nationality: id.nationality
    })
  } catch (err) {
    console.log(err)
    res.status(500).send('Internal Server Error')
  }
}