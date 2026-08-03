import { isHardProctorEnabled } from '../proctorHelpers';
import { createLocalHardProctorStub } from './localStub';
import { noopHardProctor } from './noop';
import type { HardProctorAdapter } from './types';

export type { HardProctorAdapter, HardProctorConsentResult, HardProctorStartContext } from './types';

/** Factory — later swap stub for ProctorioAdapter behind the same call. */
export function getHardProctorAdapter(): HardProctorAdapter {
  if (!isHardProctorEnabled()) return noopHardProctor;
  return createLocalHardProctorStub();
}
