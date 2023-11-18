pragma circom 2.0.0;

include "poseidon.circom";

template BasicIDVerification() {
    // Inputs
    signal input client_id_account_pair;
    signal input client_signature_issued_at_pair;
    // Outputs
    signal output basic_identity_verification;
    // Components
    component hash = Poseidon(2); // Three 512-bit blocks
    // Wires
    hash.inputs[0] <== client_id_account_pair;
    hash.inputs[1] <== client_signature_issued_at_pair;
    basic_identity_verification <== hash.out;
}

component main {public [client_id_account_pair, client_signature_issued_at_pair]} = BasicIDVerification();
