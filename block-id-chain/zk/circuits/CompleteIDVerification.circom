pragma circom 2.0.0;

include "poseidon.circom";

template CompleteIDVerification() {
    // Inputs
    signal input client_id_account_pair;
    signal input client_signature_issued_at_pair;
    signal input full_name_birth_date_pair;
    signal input identity_number_and_nationality_pair; 
    // Outputs
    signal output complete_identity_verification;
    // Components
    component hash = Poseidon(4); // Three 512-bit blocks
    // Wires
    hash.inputs[0] <== client_id_account_pair;
    hash.inputs[1] <== client_signature_issued_at_pair;
    hash.inputs[2] <== full_name_birth_date_pair;
    hash.inputs[3] <== identity_number_and_nationality_pair;
    complete_identity_verification <== hash.out;
}

component main {public [client_id_account_pair, client_signature_issued_at_pair]} = CompleteIDVerification();
