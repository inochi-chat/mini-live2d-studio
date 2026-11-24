
export function createProjectController(options = {}) {
  const {
    saveProject,
    loadProject
  } = options;

  function save() {
    if (typeof saveProject === 'function') {
      return saveProject();
    }
  }

  async function load(event) {
    if (typeof loadProject === 'function') {
      return await loadProject(event);
    }
  }

  return {
    save,
    load
  };
}
