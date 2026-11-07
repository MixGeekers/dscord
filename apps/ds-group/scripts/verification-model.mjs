import {modelReference} from '../src/model-config.mjs';

// Importing offline checks never selects a paid provider. Live entry points
// require the caller's explicit reference and use that provider's own config.
export const MODEL=process.env.DSCORD_MEMORY_TEST_MODEL||process.env.DS_GROUP_MODEL||null;
export function verificationModel(value=MODEL,{run=false}={}){
  if(value===undefined||value===null||value===''){
    if(!run)return null;
    throw Object.assign(new Error('Set DSCORD_MEMORY_TEST_MODEL or DS_GROUP_MODEL to your provider/model before running a live validation.'),{code:'TEST_MODEL_REQUIRED'});
  }
  modelReference(value);
  return value;
}
