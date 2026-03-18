import * as OTPAuth from 'otpauth';

export const generateTOTP = (secret: string) => {
  try {
    const totp = new OTPAuth.TOTP({
      secret: secret,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
    });

    const token = totp.generate();
    const remaining = 30 - (Math.floor(Date.now() / 1000) % 30);

    return {
      token: token as string,
      expires: Date.now() + remaining * 1000,
      remaining,
    };
  } catch (error) {
    console.error('Error generating TOTP:', error);
    return null;
  }
};

export const getTimeRemaining = (): number => {
  return 30 - (Math.floor(Date.now() / 1000) % 30);
};

export const validateTOTPSecret = (secret: string): boolean => {
  try {
    const totp = new OTPAuth.TOTP({ secret });
    totp.generate();
    return true;
  } catch {
    return false;
  }
};

export const generateTOTPSecret = (): string => {
  const secret = new OTPAuth.Secret({ size: 20 });
  return secret.base32;
};
