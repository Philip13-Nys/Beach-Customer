export const PHONE_MESSAGE =
  "Enter a valid Philippine mobile number, such as 09171234567 or +639171234567.";

export function normalizePhilippineMobile(value: string): string {
  const phone = value.trim();
  if (!/^(09\d{9}|\+639\d{9})$/.test(phone)) throw new Error(PHONE_MESSAGE);
  return phone.startsWith("09") ? `+63${phone.slice(1)}` : phone;
}

export const VERIFICATION_MESSAGE =
  "Thank you for registering! We have sent a verification link to your email address. Please check your inbox and click the link to verify your email before using booking features. If you cannot find the email, please check your spam or junk folder.";
