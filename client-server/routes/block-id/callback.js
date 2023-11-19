const axios = require('axios')

const User = require( '../../models/user' )
const IdentityVerification = require('../../models/identity-verification')

/**
 * @swagger
 * /block-id/callback:
 *   post:
 *     summary: Callback endpoint for Block ID verification.
 *     tags:
 *       - Block ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               source:
 *                 type: string
 *                 description: The source of the callback.
 *                 example: "source_url"
 *               code:
 *                 type: string
 *                 description: The code received for verification.
 *                 example: "verification_code"
 *               wallet:
 *                 type: string
 *                 description: The wallet address of the user.
 *                 example: "0x123abc456def789"
 *     responses:
 *       200:
 *         description: Callback processed successfully.
 *       404:
 *         description: User not found.
 *       503:
 *         description: Service unavailable or callback processing failed.
 *       500:
 *         description: Internal Server Error.
 */
module.exports = async (req, res) => {
  try{
    const { source, code, wallet } = req.body
    
    const user = await User.findOne({ walletAddress: wallet })
    if (!user) {
      return res.status(404).send('User not found')
    }
    
    const exchangeIdPath = source + 'block-id/exchange'
    const { data, status } = await axios.get(exchangeIdPath, {
      params: { code, wallet }
    })

    if (status !== 200) {
      return res.status(503).send()
    }

    await IdentityVerification.create({ user: user._id, ...data })
    res.status(200).send('OK')
  } catch (err) {
    console.log(err)
    res.status(500).send('Internal Server Error')
  }
}