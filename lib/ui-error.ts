export function uiError(err: unknown): string {
  if (err instanceof Error) {
    const message = err.message;
    if (
      message &&
      message.length < 220 &&
      !/https?:\/\//i.test(message) &&
      !/private key|seed|mnemonic/i.test(message)
    ) {
      return message;
    }
  }
  return 'Something went wrong. Please try again.';
}
