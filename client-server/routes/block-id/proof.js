const fs = require("fs");
const path = require("path");
const { prover, utils } = require("block-id-sdk");
const { hashSignals } = utils;

const appDir = path.dirname(require.main.filename);
const circuitPath = utils.getArtifactsPath() + "/circuits/CompleteIDVerification/";
const circuitWasmFilePath = circuitPath + "CompleteIDVerification_js/CompleteIDVerification.wasm";
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
module.exports = async (req, res) => {
  const { wallet } = req.query
  const timestamp = Date.now()
  // TODO: get these fields from database
  const clientId = 'CLIENT_ID_HERE'
  const kycIssuedAt = Date.now() 
  const fullName = 'John Doe'
  const birthDate = '01.01.1995'
  const identityNumber = '12345678910'
  const nationality = 'TC'

  const outputWitnessFilePath = `${appDir}/artifacts/CompleteIDVerification_${timestamp}.wtns`;
  const outputProofFilePath = `${appDir}/artifacts/CompleteIDVerification_${timestamp}.proof.json`;
  const outputPublicSignalsFilePath = `${appDir}/artifacts/CompleteIDVerification_${timestamp}.proof.ps.json`;
  
  // Prepare input for witness generation.
  console.log("Preparing input for witness generation...");
  const input = {
    client_id_account_pair: hashSignals(clientId, wallet),
    // TODO: Generate signature, We use client_id here temprarily
    client_signature_issued_at_pair: hashSignals(clientId, kycIssuedAt),
    full_name_birth_date_pair: hashSignals(fullName, birthDate),
    identity_number_and_nationality_pair: hashSignals(identityNumber, nationality),
  };

  // Generate witness.
  console.log("Generating witness...");
  await prover.generateWitness(input, circuitWasmFilePath, outputWitnessFilePath);

  // Generate proof and public signals.
  console.log("Generating proof and public signals...");
  const { proof, publicSignals } = await prover.prove(outputWitnessFilePath, zkeyFilePath, outputProofFilePath, outputPublicSignalsFilePath);
  
  res.send({ proof, publicSignals })
}
