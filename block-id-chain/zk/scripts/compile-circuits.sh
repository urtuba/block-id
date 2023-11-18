#!/bin/sh
mkdir zk/artifacts/circuits/BasicIdentity && circom2 zk/circuits/BasicIdentity.circom --r1cs --wasm --sym -l node_modules/circomlib/circuits/ -o zk/artifacts/circuits/BasicIdentity                                                                    
