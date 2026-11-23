
export function initPartEvents({
  addShape,
  duplicateSelectedPart,
  deleteSelectedPart
}) {
  document.getElementById('addCircle').onclick = () => {
    addShape('circle');
  };

  document.getElementById('addRect').onclick = () => {
    addShape('rect');
  };

  document.getElementById('duplicatePart').onclick =
    duplicateSelectedPart;

  document.getElementById('deletePart').onclick =
    deleteSelectedPart;
}
