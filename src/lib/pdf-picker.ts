import * as DocumentPicker from 'expo-document-picker';

export interface PickedPdf {
  name: string;
  size: number;
  type: string;
  uri: string;
  file?: Blob;
}

export async function pickPdf(): Promise<PickedPdf | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
  if (result.canceled) return null;
  const asset = result.assets[0];
  return { name: asset.name, size: asset.size ?? 0, type: asset.mimeType ?? 'application/pdf', uri: asset.uri, file: asset.file };
}
