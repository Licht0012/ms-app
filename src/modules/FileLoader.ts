export async function loadFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".musicxml") || name.endsWith(".xml")) {
    return await file.text();
  }
  if (name.endsWith(".mxl")) {
    return await loadMxl(file);
  }
  throw new Error(`Unsupported file extension: ${file.name}`);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function loadMxl(_file: File): Promise<string> {
  throw new Error("MXL loading not implemented yet");
}
