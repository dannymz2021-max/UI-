/** Small immutable, bounded history for a design document, not UI focus state. */
export const cloneArtState = value => JSON.parse(JSON.stringify(value));

export function createArtHistory(initial, { limit = 80, mergeWindow = 750, now = () => Date.now() } = {}) {
  const entries = [{ state: cloneArtState(initial), label: '打开设计', key: '', time: 0 }];
  let index = 0;
  const api = {
    get canUndo() { return index > 0; },
    get canRedo() { return index < entries.length - 1; },
    get undoLabel() { return index > 0 ? entries[index].label : ''; },
    get redoLabel() { return index < entries.length - 1 ? entries[index + 1].label : ''; },
    get currentLabel() { return entries[index].label; },
    get undoCount() { return index; },
    get redoCount() { return entries.length - 1 - index; },
    get current() { return cloneArtState(entries[index].state); },
    record(next, label = '编辑设计', key = '') {
      const state = cloneArtState(next);
      if (JSON.stringify(state) === JSON.stringify(entries[index].state)) return false;
      const time = now(), previous = entries[index], canMerge = !!key && index > 0 && index === entries.length - 1 && previous.key === key && time - previous.time <= mergeWindow;
      entries.splice(index + 1);
      if (canMerge) {
        entries[index] = { state, label, key, time };
        // Native input undo can return an in-progress group to its starting
        // document. Do not leave a no-op action in the canvas history.
        if (JSON.stringify(state) === JSON.stringify(entries[index - 1].state)) {
          entries.splice(index, 1); index--; entries[index].key = '';
        }
      }
      else { entries.push({ state, label, key, time }); index++; }
      while (entries.length > limit + 1) { entries.shift(); index--; }
      return true;
    },
    endGroup() { entries[index].key = ''; },
    undo() {
      if (!api.canUndo) return null;
      const label = entries[index].label;
      entries[index].key = '';
      index--; entries[index].key = '';
      return { state: api.current, label };
    },
    redo() {
      if (!api.canRedo) return null;
      index++; entries[index].key = '';
      return { state: api.current, label: entries[index].label };
    },
  };
  return api;
}
