import z from "zod";

const loginValidationSchema = z.object({
  email: z.string({
    error: "email is required"
  }),
  password: z.string({
    error: "password is required"
  }),
});


export const AuthValidation = {
  loginValidationSchema
};