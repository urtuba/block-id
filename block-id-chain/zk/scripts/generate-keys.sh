#!/bin/sh
TS_DIR="../../trusted-setup/"
cd zk/artifacts/circuits/

# Circuit: BasicIdentity
cd BasicIdentity
snarkjs groth16 setup BasicIdentity.r1cs ${TS_DIR}pot16_final.ptau BasicIdentity_0000.zkey
snarkjs zkey contribute BasicIdentity_0000.zkey BasicIdentity.zkey --name="BlockID" -v
snarkjs zkey export verificationkey BasicIdentity.zkey BasicIdentity.vkey
rm BasicIdentity_0000.zkey

# Circuit: BasicIDVerification
cd ../BasicIDVerification
snarkjs groth16 setup BasicIDVerification.r1cs ${TS_DIR}pot16_final.ptau BasicIDVerification_0000.zkey
snarkjs zkey contribute BasicIDVerification_0000.zkey BasicIDVerification.zkey --name="BlockID" -v
snarkjs zkey export verificationkey BasicIDVerification.zkey BasicIDVerification.vkey
rm BasicIDVerification_0000.zkey

# Circuit: CompleteIDVerification
cd ../CompleteIDVerification
snarkjs groth16 setup CompleteIDVerification.r1cs ${TS_DIR}pot16_final.ptau CompleteIDVerification_0000.zkey
snarkjs zkey contribute CompleteIDVerification_0000.zkey CompleteIDVerification.zkey --name="BlockID" -v
snarkjs zkey export verificationkey CompleteIDVerification.zkey CompleteIDVerification.vkey
rm CompleteIDVerification_0000.zkey

