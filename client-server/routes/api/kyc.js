const User = require( '../../models/user' )
const IdentityVerification = require('../../models/identity-verification')

/**
 * @swagger
 * /api/user/{userId}/kyc:
 *   post:
 *     summary: Perform KYC (Know Your Customer) for a user.
 *     tags:
 *       - User
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         description: Unique ID of the user for whom KYC is being performed.
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *                 description: User's first name.
 *               lastName:
 *                 type: string
 *                 description: User's last name.
 *               identityNumber:
 *                 type: string
 *                 description: User's identity number.
 *               nationality:
 *                 type: string
 *                 description: User's nationality.
 *               birthDate:
 *                 type: string
 *                 format: date
 *                 description: User's date of birth.
 *                 example: "1990-01-15"
 *     responses:
 *       201:
 *         description: KYC information created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   description: The ID of the created KYC record.
 *       404:
 *         description: User not found.
 *       500:
 *         description: Internal Server Error.
 */
module.exports = async (req, res) => {
  const { userId } = req.params

  try {
    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).send('User Not Found')
    }

    const id = await IdentityVerification.create({ user: userId, ...req.body })
    res.status(201).send({
      id: id._id
    })
  } catch (err) {
    console.log(err)
    res.status(500).send('Internal Server Error')
  }
}