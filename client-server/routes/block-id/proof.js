/**
 * @swagger
 * /block-id/proof:
 *   get:
 *     summary: Retrieve a proof from Block ID.
 *     tags:
 *       - Block ID
 *     parameters:
 *       - in: header
 *         name: block-id-api-key
 *         required: true
 *         schema:
 *           type: string
 *         description: API key needed to authorize the request.
 *     responses:
 *       200:
 *         description: Proof retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 proof:
 *                   type: string
 *                   description: The proof from Block ID.
 *       500:
 *         description: Internal Server Error.
 */
module.exports = (req, res) => {
  res.send({ proof: 'proof' })
}
