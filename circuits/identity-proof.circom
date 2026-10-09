pragma circom 2.1.0;

include "poseidon.circom";

// IdentityProof: "I know the identity behind this commitment, and I am saying so
// for this wallet, as this exchange, in answer to this request."
//
// The identity commitment is Poseidon(fullName, identityNumber, nationality,
// dateOfBirth, salt). The salt is a per-user secret. Without it, BlockID could
// brute-force low-entropy fields such as an identity number from the public
// commitment.
//
// Public signals, in the order snarkjs gives them (no circuit outputs):
//   [0] identityCommitment
//   [1] wallet     (address of the user, as a field element)
//   [2] clientId   (id of the exchange that made the proof)
//   [3] nonce      (the on-chain request id)
//
// In plain Groth16, a public input that no constraint touches is not bound by the
// proof: its verification-key point is zero, so the verifier accepts any value for
// it. snarkjs' setup adds its own constraint per public input, which hides this, but
// other toolchains may not. identityCommitment is bound by the Poseidon check.
// wallet, clientId and nonce each get a dummy square constraint, the same trick
// Tornado Cash uses, so a proof cannot be reused for another wallet, exchange or
// request whatever the toolchain. circuits/test checks this on the r1cs.
template IdentityProof() {
    // Private inputs
    signal input fullName;
    signal input identityNumber;
    signal input nationality;
    signal input dateOfBirth;
    signal input salt;

    // Public inputs (keep this order in sync with PUBLIC_SIGNALS in index.js)
    signal input identityCommitment;
    signal input wallet;
    signal input clientId;
    signal input nonce;

    component commitment = Poseidon(5);
    commitment.inputs[0] <== fullName;
    commitment.inputs[1] <== identityNumber;
    commitment.inputs[2] <== nationality;
    commitment.inputs[3] <== dateOfBirth;
    commitment.inputs[4] <== salt;
    commitment.out === identityCommitment;

    signal walletSquare;
    signal clientIdSquare;
    signal nonceSquare;
    walletSquare <== wallet * wallet;
    clientIdSquare <== clientId * clientId;
    nonceSquare <== nonce * nonce;
}

component main {public [identityCommitment, wallet, clientId, nonce]} = IdentityProof();
