import * as DocumentPicker from 'expo-document-picker';

export type PickedOrderDocument = {
  name: string;
  size: number;
  type: string;
  kind: 'PDF' | 'IMAGE';
  uri: string;
  file?: Blob;
};

const acceptedTypes = [
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'
];

function normalizeType(name: string, mimeType?: string | null) {
  const provided = mimeType?.toLowerCase();
  if (provided && acceptedTypes.includes(provided)) return provided;
  const extension = name.toLowerCase().split('.').pop();
  return ({ pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif' } as Record<string, string>)[extension ?? ''] ?? '';
}

export async function pickOrderDocument(_source: 'files' | 'camera' = 'files'): Promise<PickedOrderDocument | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: acceptedTypes, copyToCacheDirectory: true });
  if (result.canceled) return null;
  const asset = result.assets[0];
  const type = normalizeType(asset.name, asset.mimeType);
  if (!type) throw new Error('Selectează un PDF sau o imagine JPEG, PNG, WebP, HEIC ori HEIF.');
  return {
    name: asset.name, size: asset.size ?? 0, type,
    kind: type === 'application/pdf' ? 'PDF' : 'IMAGE', uri: asset.uri, file: asset.file
  };
}
