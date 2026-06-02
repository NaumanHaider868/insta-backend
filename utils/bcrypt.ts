import bcrypt from 'bcrypt';

const hashPassword = (password: string) => {
  if (!password) return null;
  return bcrypt.hash(password, 10);
};

const comparePassword = (password: string, userPassword: string) => {
  if (!password || !userPassword) return null;
  return bcrypt.compare(password, userPassword);
};

export { comparePassword, hashPassword };
