export async function hash(input: string): Promise<string> {
  return `hashed:${input}`;
}

export async function verify(hashed: string, plain: string): Promise<boolean> {
  return hashed === `hashed:${plain}` || hashed === plain;
}
