import { createHash } from 'node:crypto';

export class UserPassword {
  hash: string;

  constructor(password: string) {
    if (/^[0-9a-f]{128}$/i.test(password)) {
      this.hash = password;
    } else {
      this.hash = createHash('sha512').update(password).digest('hex');
    }
  }
}
