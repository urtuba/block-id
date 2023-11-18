const User = require( '../../models/user' )
const BlockIdGrantCode = require( '../../models/block-id-grant-code' )
const IdentityVerification = require('../../models/identity-verification')

/**
 * @swagger
 * /block-id/exchange:
 *   get:
 *     summary: Retrieve user identity information for Block ID exchange.
 *     tags:
 *       - Block ID
 *     parameters:
 *       - in: header
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *         description: The exchange code associated with the user.
 *       - in: header
 *         name: wallet
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User identity information retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 firstName:
 *                   type: string
 *                   description: The user's first name.
 *                 lastName:
 *                   type: string
 *                   description: The user's last name.
 *                 birthDate:
 *                   type: string
 *                   description: The user's birth date.
 *                 identityNumber:
 *                   type: string
 *                   description: The user's identity number.
 *                 nationality:
 *                   type: string
 *                   description: The user's nationality.
 *       400:
 *         description: Bad request. Missing exchange code.
 *       404:
 *         description: User not found or grant code not found.
 *       500:
 *         description: Internal Server Error.
 */
module.exports = async (req, res) => {
  const { code, wallet: walletAddress } = req.headers
  if (!code) {
    return res.status(400).send('Missing Code')
  }

  try {
    const user = await User.findOne({ walletAddress })
    if (!user) {
      return res.status(404).send('User Not Found')
    }

    const grantCode = await BlockIdGrantCode.findOne({ user: user._id, code })
    if (!grantCode || grantCode.validUntil < Date.now()) {
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