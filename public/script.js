document.getElementById('uploadForm').addEventListener('submit', function (e) {
  e.preventDefault();

  const file = document.getElementById('file').files[0];
  const outputType = document.getElementById('outputType').value;
  const formData = new FormData();
  formData.append('mt940', file);
  formData.append('outputType', outputType);

  fetch('/upload', {
    method: 'POST',
    body: formData,
  })
    .then((response) => response.blob())
    .then((blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;

      // Extract the original file name without extension
      const originalFileName = file.name.replace(/\.[^/.]+$/, '');

      // Set the download filename based on output type
      if (outputType === 'excel') {
        a.download = `${originalFileName}.xlsx`;
      } else if (outputType === 'xml') {
        a.download = `${originalFileName}.xml`;
      } else if (outputType === 'ofx') {
        a.download = `${originalFileName}.ofx`;
      } else {
        a.download = `${originalFileName}.unknown`; // Fallback for unsupported types
      }

      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    })
    .catch((err) => {
      document.getElementById('result').innerText =
        'Conversion failed. Please try again.';
      console.error(err);
    });
});
