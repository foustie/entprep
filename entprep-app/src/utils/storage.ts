import type { UserData, SRCard } from '../types/index';
import { captureError } from '../config/sentry';

const STORAGE_KEY = 'entprep_data';

function loadData(): UserData | null {
  try {
    const r = localStorage.getItem(STORAGE_KEY);
    return r ? JSON.parse(r) : null;
  } catch {
    return null;
  }
}

function saveData(d: UserData): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
    return true;
  } catch (e) {
    captureError(e, { context: 'storage.saveData' });
    return false;
  }
}

function loadSrCards(): SRCard[] {
  return loadData()?.srCards || [];
}

export { loadData, saveData, loadSrCards };
