export function initProjectIO({
  saveProject,
  loadProject
}) {
  const saveButton = document.getElementById('saveProject');
  const loadInput = document.getElementById('loadProject');

  saveButton.addEventListener('click', saveProject);
  loadInput.addEventListener('change', loadProject);
}
