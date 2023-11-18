#!/bin/sh
TS_DIR="../../trusted-setup/"
# Circuit: BasicIdentity
cd zk/artifacts/circuits/BasicIdentity
snarkjs groth16 setup BasicIdentity.r1cs ${TS_DIR}pot16_final.ptau BasicIdentity_0000.zkey
snarkjs zkey contribute BasicIdentity_0000.zkey BasicIdentity.zkey --name="BlockID" -v
snarkjs zkey export verificationkey BasicIdentity.zkey BasicIdentity.vkey
rm BasicIdentity_0000.zkey

