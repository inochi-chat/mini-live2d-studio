
export function createEditorController(options = {}) {
  const {
    initEditorEvents
  } = options;

  function init(events = {}) {
    if (typeof initEditorEvents !== 'function') {
      return;
    }

    initEditorEvents(events);
  }

  return {
    init
  };
}
