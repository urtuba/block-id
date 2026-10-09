import { expect } from "chai";
import { PRIVATE_INPUTS, PUBLIC_SIGNALS } from "../index.js";
import { isInfinity, loadR1cs, makeInput, prove, unboundPublicSignals, verify, vkey, wiresWithoutConstraint } from "./helpers.js";

// A Groth16 public input that no constraint touches is not bound by the proof: the
// proof stays valid when the verifier is given another value for it. These tests make
// sure every public signal of the circuit is bound, and that the checks themselves
// can fail.
describe("public signal binding", () => {
  let proof, publicSignals;

  before(async () => {
    ({ proof, publicSignals } = await prove(makeInput({ wallet: 100n, clientId: 3n, nonce: 9n })));
  });

  it("the verification key has one input point per public signal", () => {
    expect(vkey.nPublic).to.equal(PUBLIC_SIGNALS.length);
    expect(vkey.IC).to.have.length(PUBLIC_SIGNALS.length + 1);
  });

  PUBLIC_SIGNALS.forEach((name, index) => {
    it(`${name} is constrained: its verification key input point is not zero`, () => {
      expect(isInfinity(vkey.IC[index + 1])).to.equal(false);
    });

    it(`a proof does not verify when ${name} is changed`, async () => {
      const tampered = [...publicSignals];
      tampered[index] = (BigInt(tampered[index]) + 1n).toString();
      expect(await verify(tampered, proof)).to.equal(false);
    });
  });

  describe("in the r1cs", () => {
    // Wires 1..4 are the public inputs (the circuit has no outputs), 5..9 the private ones.
    let r1cs;
    before(async () => {
      r1cs = await loadR1cs();
    });

    it("has the signals the circuit declares", () => {
      expect(r1cs.nOutputs).to.equal(0);
      expect(r1cs.nPubInputs).to.equal(PUBLIC_SIGNALS.length);
      expect(r1cs.nPrvInputs).to.equal(PRIVATE_INPUTS.length);
    });

    it("every public and private input appears in at least one constraint", () => {
      expect(wiresWithoutConstraint(r1cs)).to.deep.equal([]);
    });

    it("the detector reports an input that no constraint uses", () => {
      // The same circuit without the `clientId * clientId` constraint: drop every
      // constraint that mentions wire 3 (clientId) and the detector must name it.
      const clientIdWire = PUBLIC_SIGNALS.indexOf("clientId") + 1;
      const withoutClientId = {
        ...r1cs,
        constraints: r1cs.constraints.filter((c) => !c.some((lc) => lc[clientIdWire] !== undefined)),
      };
      expect(r1cs.constraints.length - withoutClientId.constraints.length).to.equal(1);
      expect(wiresWithoutConstraint(withoutClientId)).to.deep.equal([clientIdWire]);
    });
  });

  it("the unbound-input detector reports a signal whose input point is zero", () => {
    // A key from a circuit that ignored `clientId` would look like this.
    const broken = structuredClone(vkey);
    broken.IC[3] = ["0", "1", "0"];
    expect(unboundPublicSignals(vkey)).to.deep.equal([]);
    expect(unboundPublicSignals(broken)).to.deep.equal([PUBLIC_SIGNALS.indexOf("clientId")]);
  });

  describe("replay", () => {
    it("a proof made for one wallet does not verify for another wallet", async () => {
      const other = [...publicSignals];
      other[1] = "101";
      expect(await verify(other, proof)).to.equal(false);
    });

    it("a proof made for one request does not verify for another nonce", async () => {
      const other = [...publicSignals];
      other[3] = "10";
      expect(await verify(other, proof)).to.equal(false);
    });

    it("a proof made by one exchange does not verify for another client id", async () => {
      const other = [...publicSignals];
      other[2] = "4";
      expect(await verify(other, proof)).to.equal(false);
    });

    it("a proof does not verify with a missing or an extra public signal", async () => {
      const { log } = console;
      console.log = () => {}; // snarkjs logs "Invalid public inputs"
      try {
        // snarkjs answers false for a missing signal and throws for an extra one
        const accepted = (signals) => verify(signals, proof).catch(() => false);
        expect(await accepted(publicSignals.slice(0, 3))).to.equal(false);
        expect(await accepted([...publicSignals, "0"])).to.equal(false);
      } finally {
        console.log = log;
      }
    });
  });
});
