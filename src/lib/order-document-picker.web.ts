export type PickedOrderDocument = {
  name: string;
  size: number;
  type: string;
  kind: 'PDF' | 'IMAGE';
  uri: string;
  file: Blob;
};

const typesByExtension: Record<string, string> = {
  pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  webp: 'image/webp', heic: 'image/heic', heif: 'image/heif'
};
const acceptedTypes = new Set(Object.values(typesByExtension));

function normalizeType(file: File) {
  const provided = file.type.toLowerCase();
  if (acceptedTypes.has(provided)) return provided;
  return typesByExtension[file.name.toLowerCase().split('.').pop() ?? ''] ?? '';
}

export function pickOrderDocument(source: 'files' | 'camera' = 'files'): Promise<PickedOrderDocument | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = source === 'camera'
      ? 'image/jpeg,image/png,image/webp,image/heic,image/heif,image/*'
      : 'application/pdf,.pdf,image/jpeg,.jpg,.jpeg,image/png,.png,image/webp,.webp,image/heic,.heic,image/heif,.heif';
    if (source === 'camera') input.capture = 'environment';
    input.style.display = 'none';
    const finish = (value: PickedOrderDocument | null) => {
      window.removeEventListener('focus', handleFocus);
      input.remove();
      resolve(value);
    };
    const handleFocus = () => window.setTimeout(() => { if (!input.files?.length) finish(null); }, 300);
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return finish(null);
      const type = normalizeType(file);
      if (!type) {
        window.removeEventListener('focus', handleFocus);
        input.remove();
        reject(new Error('Selectează un PDF sau o imagine JPEG, PNG, WebP, HEIC ori HEIF.'));
        return;
      }
      finish({
        name: file.name, size: file.size, type,
        kind: type === 'application/pdf' ? 'PDF' : 'IMAGE', uri: URL.createObjectURL(file), file
      });
    }, { once: true });
    document.body.appendChild(input);
    window.addEventListener('focus', handleFocus, { once: true });
    input.click();
  });
}
