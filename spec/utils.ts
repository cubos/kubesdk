export async function expectThrows(
  promise: Promise<any>,
  errorClass: jest.Constructable,
  message?: string
) {
  await expect(promise).rejects.toThrow(errorClass);
  if (message !== undefined) {
    await expect(promise).rejects.toThrow(message);
  }
}
