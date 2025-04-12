import { compile, createFileManager } from "@noir-lang/noir_wasm"
import { UltraPlonkBackend } from '@aztec/bb.js';
import { Noir } from '@noir-lang/noir_js';

import initNoirC from "@noir-lang/noirc_abi";
import initACVM from "@noir-lang/acvm_js";
import acvm from "@noir-lang/acvm_js/web/acvm_js_bg.wasm?url";
import noirc from "@noir-lang/noirc_abi/web/noirc_abi_wasm_bg.wasm?url";

import main from "./inner/src/main.nr?url";
import nargoToml from "./inner/Nargo.toml?url";

await Promise.all([initACVM(fetch(acvm)), initNoirC(fetch(noirc))]);

export async function getCircuit() {
  const fm = createFileManager("/");
  const { body } = await fetch(main);
  const { body: nargoTomlBody } = await fetch(nargoToml);

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
    show("logs", "Loading circuit... ⏳");
    const { program } = await getCircuit();
    const noir = new Noir(program);
    const backend = new UltraPlonkBackend(program.bytecode, { threads: 8 }, { recursive: true });
    show("logs", "Circuit loaded. ✅");

    show("logs", "Generating witness... ⏳");
    const { witness } = await noir.execute({ x: 1 , y: 2 });
    show("logs", "Generated witness. ✅");

    show("logs", "Generating proof... ⏳");
    const { proof, publicInputs } = await backend.generateProof(witness);
    show("logs", "Generated proof. ✅");
    show("results", proof);

    const verified = await backend.verifyProof({ proof, publicInputs });
    show("logs", `Verified ${verified}`);

    show("logs", "Generating recursive inputs... ⏳");
    const publicInputsCount = 17;
    const { proofAsFields, vkAsFields, vkHash } = await backend.generateRecursiveProofArtifacts( { publicInputs, proof }, publicInputsCount);
    show("logs", "Generated recursive inputs. ✅");

    const recursiveInputs = {
        verification_key: vkAsFields, // array of length 114
        proof: proofAsFields, // array of length 93 + size of public inputs
        publicInputs: [2], // using the example above, where `y` is the only public input
        key_hash: vkHash,
    };

    console.log(recursiveInputs);

  } catch(error) {
    console.log(error);
    show("logs", "Oh 💔");
  }
});

