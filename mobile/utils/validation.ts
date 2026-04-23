export const isValidEmail = (email: string) => {
    /* Checks for the presence of characters before and after the "@" symbol, 
     and a valid domain structure. */
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const isValidPassword = (password: string) => {
    /* Password must be at least 6 characters long, 
    contain at least one uppercase letter, one lowercase letter, and one number. */
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/;
  return passwordRegex.test(password);
};