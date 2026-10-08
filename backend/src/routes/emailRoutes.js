import express from "express";
import { emailActionLimiter } from "../middlewares/rateLimiters.js";
import {
  verifyEmail,
  unsubscribeEmail,
} from "../controllers/emailController.js";

export const emailRoutes = express.Router();

emailRoutes.get("/email/verify", emailActionLimiter, verifyEmail);
emailRoutes.get("/email/unsubscribe", emailActionLimiter, unsubscribeEmail);
