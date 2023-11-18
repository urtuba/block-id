const User = require('../../models/user');
const BlockIdGrantCode = require('../../models/block-id-grant-code');

/**
 * @swagger
 * /block-id/grant-code:
 *   post:
 *     summary: Create a new grant code for Block ID.
 *     tags:
 *       - Block ID
 *     parameters:
 *       - in: header
 *         name: block-id-api-key
 *         required: true
 *         schema:
 *           type: string
 *         description: API key needed to authorize the request.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               walletAddress:
 *                 type: string
 *                 description: The user's wallet address.
 *     responses:
 *       201:
 *         description: Grant code created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: string
 *                   description: The newly created grant code.
 *       400:
 *         description: Bad request. Missing wallet address.
 *       404:
 *         description: User not found.
 *       500:
 *         description: Internal Server Error.
 */
module.exports = async (req, res) => {
  const { walletAddress } = req.body;

  try {
    const user = await User.findOne({ walletAddress });
    if (!user) {
      return res.status(404).send('User Not Found');
    }

    const newGrantCode = await BlockIdGrantCode.create({user: user._id});

    res.status(201).send({ code: newGrantCode.code })
  } catch (err) {
    console.log(err);
    res.status(500).send('Internal Server Error');
  }
};