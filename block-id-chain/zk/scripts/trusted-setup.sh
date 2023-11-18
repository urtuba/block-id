#!/bin/sh
cd zk/artifacts/trusted-setup/
snarkjs powersoftau new bn128 16 pot16_0000.ptau -v
snarkjs powersoftau contribute pot16_0000.ptau pot16_0001.ptau --name="First Contribution" -v 
snarkjs powersoftau prepare phase2 pot16_0001.ptau pot16_final.ptau -v
