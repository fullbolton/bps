import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';

const {enabledNotificationTenants: read} = await importActualTypeScript(new URL('../src/lib/email/task-module-access.ts', import.meta.url));

for (const module of ['tasks', 'calendar', 'contracts']) {
  test(`${module}: malformed eligibility never becomes permission to send`, async () => {
    const good = [{tenant_id:'A', enabled:true}, {tenant_id:'B', enabled:false}];
    const client = data => ({rpc: async (name, args) => {
      assert.equal(name, module === 'tasks' ? 'task_notification_modules_v1' : 'customer_notification_modules_v1');
      assert.deepEqual(args, module === 'tasks' ? {p_tenant_ids:['A','B']} : {p_tenant_ids:['A','B'], p_module:module});
      return {data, error:null};
    }});
    assert.deepEqual([...await read(client(good), ['A','B'], module)], ['A']);
    for (const data of [null, {}, [], [good[0]], [good[0],good[0]], [null,good[1]],
      [{...good[0],tenant_id:'foreign'},good[1]],
      ...[null, undefined, 'true', 1].map(enabled => [{...good[0],enabled},good[1]])]) {
      await assert.rejects(read(client(data), ['A','B'], module), /UNVERIFIABLE/);
    }
  });

  test(`${module}: second-page failure rejects the whole result, including previously enabled tenants`, async () => {
    const ids = Array.from({length:501}, (_, i) => `tenant-${i}`);
    for (const failure of ['rpc', 'transport', 'missing']) {
      const sizes = [];
      const client = {rpc: async (_, args) => {
        sizes.push(args.p_tenant_ids.length);
        if (sizes.length === 2) {
          if (failure === 'transport') throw Error('offline');
          return {data:[], error:failure === 'rpc' ? {code:'55000'} : null};
        }
        return {data:args.p_tenant_ids.map(tenant_id => ({tenant_id,enabled:true})),error:null};
      }};
      await assert.rejects(read(client, [...ids, ids[0]], module));
      assert.deepEqual(sizes, [500,1]);
    }
  });
}

test('empty notification scope makes no RPC call', async () => {
  assert.equal((await read({rpc(){throw Error('unexpected query');}}, [], 'tasks')).size, 0);
});
