
export function createHistoryManager({
  createSnapshot,
  restoreSnapshot,
  limit = 30
}) {
  let undoStack = [];
  let redoStack = [];
  let busy = false;

  function save() {
    if (busy) return;

    undoStack.push(createSnapshot());

    if (undoStack.length > limit) {
      undoStack.shift();
    }

    redoStack = [];
  }

  async function undo() {
    if (busy || !undoStack.length) return;

    busy = true;

    try {
      redoStack.push(createSnapshot());

      const snapshot = undoStack.pop();
      await restoreSnapshot(snapshot);
    } finally {
      busy = false;
    }
  }

  async function redo() {
    if (busy || !redoStack.length) return;

    busy = true;

    try {
      undoStack.push(createSnapshot());

      const snapshot = redoStack.pop();
      await restoreSnapshot(snapshot);
    } finally {
      busy = false;
    }
  }

  function clear() {
    undoStack = [];
    redoStack = [];
  }

  return {
    save,
    undo,
    redo,
    clear
  };
}
