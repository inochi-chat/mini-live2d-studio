
import { createHistoryManager } from '../history.js';

// Undo・Redoを管理
export function createHistoryController(options = {}) {
  const {
    createSnapshot,
    restoreSnapshot,
    limit = 30
  } = options;

  const history = createHistoryManager({
    createSnapshot,
    restoreSnapshot,
    limit
  });

  function saveUndo() {
    history.save();
  }

  async function undo() {
    await history.undo();
  }

  async function redo() {
    await history.redo();
  }

  function clear() {
    history.clear();
  }

  return {
    history,
    saveUndo,
    undo,
    redo,
    clear
  };
}
