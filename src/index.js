import { compile, createFileManager } from "@noir-lang/noir_wasm"
import { UltraHonkBackend, Barretenberg, RawBuffer } from '@aztec/bb.js';
import { Noir } from '@noir-lang/noir_js';

import initNoirC from "@noir-lang/noirc_abi";
import initACVM from "@noir-lang/acvm_js";
import acvm from "@noir-lang/acvm_js/web/acvm_js_bg.wasm?url";
import noirc from "@noir-lang/noirc_abi/web/noirc_abi_wasm_bg.wasm?url";

import innerMain from "./inner/src/main.nr?url";
import innerNargoToml from "./inner/Nargo.toml?url";
import outerMain from "./outer/src/main.nr?url";
import outerNargoToml from "./outer/Nargo.toml?url";

await Promise.all([initACVM(fetch(acvm)), initNoirC(fetch(noirc))]);

async function getInnerCircuit() {
  const fm = createFileManager("/");
  const { body } = await fetch(innerMain);
  const { body: nargoTomlBody } = await fetch(innerNargoToml);

  fm.writeFile("./src/main.nr", body);
  fm.writeFile("./Nargo.toml", nargoTomlBody);
  return await compile(fm);
}

async function getOuterCircuit() {
  const fm = createFileManager("/");
  const { body } = await fetch(outerMain);
  const { body: nargoTomlBody } = await fetch(outerNargoToml);

  fm.writeFile("./src/main.nr", body);
  fm.writeFile("./Nargo.toml", nargoTomlBody);
  return await compile(fm);
}

const show = (id, content) => {
  const container = document.getElementById(id);
  container.appendChild(document.createTextNode(content));
  container.appendChild(document.createElement("br"));
};

document.getElementById("submit").addEventListener("click", async () => {
  try {
    // noir goes here
    show("logs", "Loading inner circuit... ⏳");
    const { program: innerProgram } = await getInnerCircuit();
    const innerNoir = new Noir(innerProgram);
    const innerBackend = new UltraHonkBackend(innerProgram.bytecode, { threads: 8 }, { recursive: true });
    show("logs", "Inner circuit loaded. ✅");

    show("logs", "Generating inner witness... ⏳");
    const { witness: innerWitness } = await innerNoir.execute({ x: 1 , y: 2 });
    show("logs", "Generated inner witness. ✅");

    show("logs", "Generating inner proof... ⏳");
    const {
      proof: innerProof,
      publicInputs: innerPublicInputs
    } = await innerBackend.generateProof(innerWitness);
    show("logs", "Generated inner proof. ✅");

    // Not strictly necessary to do this here but for illustration
    const innerVerified = await innerBackend.verifyProof({
      publicInputs: innerPublicInputs,
      proof: innerProof,
    });
    show("logs", `Inner proof verified: ${innerVerified}`);

    show("logs", "Generating recursive inputs... ⏳");
    const recursiveProof = await innerBackend.generateProofForRecursiveAggregation(innerWitness);
    // Get verification key for inner circuit as fields
    const innerCircuitVerificationKey = await innerBackend.getVerificationKey();
    const barretenbergAPI = await Barretenberg.new({ threads: 1 });
    const vkAsFields = (await barretenbergAPI.acirVkAsFieldsUltraHonk(new RawBuffer(innerCircuitVerificationKey))).map(field => field.toString());
    show("logs", "Generated recursive inputs. ✅");

    show("logs", "Loading outer circuit... ⏳");
    const { program: outerProgram } = await getOuterCircuit();
    const outerNoir = new Noir(outerProgram);
    const outerBackend = new UltraHonkBackend(outerProgram.bytecode, { threads: 8 });
    show("logs", "Outer circuit loaded. ✅");

    show("logs", "Generating outer witness... ⏳");
    const outerInputs = {
      public_inputs: recursiveProof.publicInputs,
      key_hash: '0x0',
      proof: recursiveProof.proof,
      verification_key: vkAsFields,
      z: '0xd00d',
    };

    const { witness: outerWitness } = await outerNoir.execute(outerInputs);
    show("logs", "Generated outer witness. ✅");

    show("logs", "Generating outer proof... ⏳");
    const startTime = Date.now();
    const {
      proof: outerProof,
      publicInputs: outerPublicInputs
    } = await outerBackend.generateProof(outerWitness);
    show("logs", `Generated outer proof. ✅ (${(Date.now() - startTime)/1000}s)`);
    show("results", outerProof);
    console.log(outerProof, outerPublicInputs);

    const outerVerified = await outerBackend.verifyProof({
      publicInputs: outerPublicInputs,
      proof: outerProof,
    });
    show("logs", `Outer proof verified: ${outerVerified}`);

  } catch(error) {
    console.log(error);
    show("logs", "Oh 💔");
  }
});

