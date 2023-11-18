pragma circom 2.0.0;

include "poseidon.circom";

template BasicIdentity() {
    component hash = Poseidon(3); // Three 512-bit blocks
    signal input client_id_and_full_name;
    signal input identity_number_and_nationality; 
    signal input date_of_birth_padded;
    hash.inputs[0] <== client_id_and_full_name;
    hash.inputs[1] <== identity_number_and_nationality;
    hash.inputs[2] <== date_of_birth_padded;

    signal output identity_out;
    identity_out <== hash.out;
}

component main {public [client_id_and_full_name]} = BasicIdentity();
