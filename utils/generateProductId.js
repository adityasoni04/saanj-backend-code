import { customAlphabet } from 'nanoid';

export const generateProductId = () => {
    const nanoid = customAlphabet('1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ', 7);
    return nanoid();
};

