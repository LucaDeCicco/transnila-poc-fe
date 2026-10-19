export interface PickedPdf {
  name: string;
  size: number;
  type: string;
  uri: string;
  file: Blob;
}

export function pickPdf(): Promise<PickedPdf | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf,.pdf';
    input.style.display = 'none';
    const finish = (value: PickedPdf | null) => {
      window.removeEventListener('focus', handleFocus);
      input.remove();
      resolve(value);
    };
    const handleFocus = () => window.setTimeout(() => { if (!input.files?.length) finish(null); }, 300);
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return finish(null);
      finish({ name: file.name, size: file.size, type: file.type || 'application/pdf', uri: URL.createObjectURL(file), file });
    }, { once: true });
    document.body.appendChild(input);
    window.addEventListener('focus', handleFocus, { once: true });
    input.click();
  });
}
