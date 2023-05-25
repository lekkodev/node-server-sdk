import { ClientContext } from '../context';
import { Value } from '@buf/lekkodev_sdk.bufbuild_es/lekko/client/v1beta1/configuration_service_pb';

test('empty constructor', () => {
  const ctx = new ClientContext();
  expect(ctx.data).toEqual({});
  expect(ctx.get('missing')).toBe(undefined);
});

test('setting fields', () => {
  const ctx = (new ClientContext())
    .setBoolean('bool', true)
    .setInt('integer', 42)
    .setDouble('double', 3.14)
    .setString('string', 'foobar');
  expect(ctx.get('bool')).toEqual(Value.fromJson({
    boolValue: true,
  }));
  expect(ctx.get('integer')).toEqual(Value.fromJson({
    intValue: 42,
  }));
  expect(ctx.get('double')).toEqual(Value.fromJson({
    doubleValue: 3.14,
  }));
  expect(ctx.get('string')).toEqual(Value.fromJson({
    stringValue: 'foobar',
  }));
});
