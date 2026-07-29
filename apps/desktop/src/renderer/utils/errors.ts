export function getErrorMessage(error: unknown, fallback = 'La operación no pudo completarse.'): string {
  if (error instanceof Error) {
    const zodMessage = error.message.match(/"message":\s*"([^"]+)"/)?.[1];
    const message = zodMessage || error.message;
    return message
      .replace(/^Error invoking remote method '[^']+':\s*/i, '')
      .replace(/^Error:\s*/i, '')
      .replace(/Validation failed:/i, 'Los datos enviados no son válidos:');
  }
  return typeof error === 'string' && error.trim() ? error : fallback;
}
