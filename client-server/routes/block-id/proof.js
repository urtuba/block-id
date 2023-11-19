const fs = require("fs");
const path = require("path");
const { prover, utils } = require("block-id-sdk");
const { hashSignals } = utils;

const User = require("../../models/user.js");
const IdentityVerification = require("../../models/identity-verification.js");

const appDir = path.dirname(require.main.filename);
const circuitPath =
  utils.getArtifactsPath() + "circuits/CompleteIDVerification/";
const circuitWasmFilePath =
  circuitPath + "CompleteIDVerification_js/CompleteIDVerification.wasm";
const zkeyFilePath = circuitPath + "CompleteIDVerification.zkey";
// const vkeyFilePath = circuitPath + "CompleteIDVerification.vkey";

/**
 * @swagger
 * /block-id/proof:
 *   get:
 *     summary: Retrieve a proof from Block ID.
 *     tags:
 *       - Block ID
 *     parameters:
 *       - in: query
 *         name: wallet
 *         required: true
 *         description: Wallet address of the user to verify.
 *         schema:
 *           type: string
 *       - in: header
 *         name: block-id-api-key
 *         required: true
 *         description: Authenticates block id requests
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Successfully retrieved the identity verification proof and public signals.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 proof:
 *                   type: object
 *                   description: The proof of identity verification.
 *                 publicSignals:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: Public signals associated with the proof.
 *       400:
 *         description: Bad request. Wallet parameter is missing.
 *       404:
 *         description: User or identity information not found.
 *       500:
 *         description: Internal server error.
 */
module.exports = async (req, res) => {
  const { wallet } = req.query;
  if (!wallet) {
    return res.status(400).send("Wallet required");
  }

  try {
    const user = await User.findOne({ walletAddress: wallet });
    if (!user) {
      return res.status(404).send("User not found");
    }

    const id = await IdentityVerification.findOne({ user: user._id });
    if (!id) {
      return res.status(404).send("Identity info not found");
    }

    const timestamp = Date.now();

    const clientId = process.env.BLOCK_ID_CLIENT_ID;
    const kycIssuedAt = id.createdAt.toString();
    const fullName = id.firstName + " " + id.lastName;
    const birthDate = id.birthDate.toString(); // Check if toString required
    const identityNumber = id.identityNumber;
    const nationality = id.nationality;

    const outputWitnessFilePath = `${appDir}/artifacts/CompleteIDVerification_${timestamp}.wtns`;
    const outputProofFilePath = `${appDir}/artifacts/CompleteIDVerification_${timestamp}.proof.json`;
    const outputPublicSignalsFilePath = `${appDir}/artifacts/CompleteIDVerification_${timestamp}.proof.ps.json`;

 
    // Prepare input for witness generation.
    console.log("Preparing input for witness generation...");
    const input = {
      data_hash: hashSignals(fullName, birthDate, identityNumber, nationality, birthDate),
      // TODO: Generate signature, We use client_id here temprarily
      client_id_account_pair: hashSignals(clientId, wallet),
      client_signature_issued_at_pair: hashSignals(clientId, kycIssuedAt),
      full_name_birth_date_pair: hashSignals(fullName, birthDate),
      identity_number_and_nationality_pair: hashSignals(
        identityNumber,
        nationality
      ),
    };

    // Generate witness.
    console.log("Generating witness...");
    await prover.generateWitness(
      input,
      circuitWasmFilePath,
      outputWitnessFilePath
    );

    // Generate proof and public signals.
    console.log("Generating proof and public signals...");
    const { proof, publicSignals } = await prover.prove(
      outputWitnessFilePath,
      zkeyFilePath,
      outputProofFilePath,
      outputPublicSignalsFilePath
    );

    return res.send({ proof, publicSignals });
  } catch (err) {
    console.error(err);
    return res.status(500).send("Internal server error");
  }
};
