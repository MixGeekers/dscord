import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { verificationModel } from '../scripts/verification-model.mjs';

test('read-only verification may omit a model; live verification requires a valid caller selection',()=>{
  assert.equal(verificationModel(null),null);
  for(const model of ['own/team/fast','local/model-fast'])assert.equal(verificationModel(model,{run:true}),model);
  assert.throws(()=>verificationModel(null,{run:true}),{code:'TEST_MODEL_REQUIRED'});
  for(const value of ['invalid','provider/model name',42])assert.throws(()=>verificationModel(value),{code:'INVALID_MODEL'});
});

test('default verify CLI performs no fixture read or model request, even with a caller model',async()=>{
  const env={...process.env,DS_GROUP_MATRIX_SETUP_PATH:'/nonexistent/dscord-validation-fixture.json'};
  delete env.DSCORD_MEMORY_TEST_MODEL;delete env.DS_GROUP_MODEL;
  for(const args of [[],['--model','own/team/fast']]){
    const result=await promisify(execFile)(process.execPath,['scripts/verify.mjs',...args],{cwd:new URL('..',import.meta.url),env,timeout:10000});
    const summary=JSON.parse(result.stdout);assert.equal(summary.status,'not-run');assert.equal(summary.modelCalls,0);
    assert.equal(summary.model,args.length?'own/team/fast':null);
  }
});

test('live verification CLIs reject an omitted model before reading fixture files or services',async()=>{
  const env={...process.env,DS_GROUP_MATRIX_SETUP_PATH:'/nonexistent/dscord-validation-fixture.json'};
  delete env.DSCORD_MEMORY_TEST_MODEL;delete env.DS_GROUP_MODEL;
  for(const file of ['verify.mjs','verify-file-work.mjs']){
    await assert.rejects(promisify(execFile)(process.execPath,[`scripts/${file}`,'--run'],{cwd:new URL('..',import.meta.url),env,timeout:10000}),error=>{
      assert.match(error.stderr,/TEST_MODEL_REQUIRED/);assert.doesNotMatch(error.stderr,/ENOENT|ECONNREFUSED/);return true;
    });
  }
});
